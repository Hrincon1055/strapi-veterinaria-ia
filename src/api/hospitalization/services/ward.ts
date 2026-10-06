import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { programarTomas, estadoDeToma, MINUTOS_DE_GRACIA } from '../domain/tomas';
import { diaEnZona, diaSiguiente, esDia, horaEnZona, inicioDelDia, ms } from '../domain/tiempo';

const { ValidationError } = errors;

/**
 * La sala de hospitalización: lo que pinta y lo que hace la página del panel
 * (plugin `veterinaria-hospitalizacion`, 5.6).
 *
 * Orquesta, no valida: escribe por el Document Service y las reglas de
 * `src/validations/hospitalization.ts` deciden, igual que si se escribiera
 * desde el Content Manager. El plugin solo comprueba permisos y delega aquí,
 * como la facturación delega en `api::billing.invoicing`.
 *
 * Las horas que ve el panel salen ya formateadas en la zona de Clínica
 * (`hora`, `horaTexto`): la rejilla no depende de la zona del navegador.
 */

const HOSPITALIZACION = 'api::hospitalization.hospitalization';
const JAULA = 'api::hospitalization.cage';
const ORDEN = 'api::hospitalization.treatment-order';
const EVOLUCION = 'api::hospitalization.evolution-entry';
const ADMINISTRACION = 'api::hospitalization.medication-administration';

const PRESCRIBIBLES = ['medication', 'vaccine', 'supply'];
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

const texto = (v: any): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const nombre = (p: any): string | null => (p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || null : null);
const cuenta = (u: any): string | null => (u ? `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || u.email || null : null);

/** Texto de un campo `blocks`, un párrafo por línea. */
export function bloquesATexto(bloques: any): string | null {
  if (!Array.isArray(bloques)) return null;
  const lineas: string[] = [];
  const recorrer = (nodos: any[]): string => nodos.map((n) => (typeof n.text === 'string' ? n.text : recorrer(n.children ?? []))).join('');
  for (const b of bloques) {
    if (b.type === 'list') {
      for (const item of b.children ?? []) lineas.push(`• ${recorrer(item.children ?? [])}`);
    } else {
      lineas.push(recorrer(b.children ?? []));
    }
  }
  const t = lineas.join('\n').trim();
  return t || null;
}

/** Un campo `blocks` a partir de texto: un párrafo por línea. */
export function textoABloques(t: any): any[] | null {
  const limpio = texto(t);
  if (!limpio) return null;
  return limpio.split(/\r?\n/).map((linea) => ({ type: 'paragraph', children: [{ type: 'text', text: linea }] }));
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const hosp = () => strapi.service(HOSPITALIZACION as any) as any;

  /** "08:30" y "06 oct 08:30" en la zona de Clínica. */
  const formateadores = (zona: string) => {
    const h = new Intl.DateTimeFormat('es-CO', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const fh = new Intl.DateTimeFormat('es-CO', { timeZone: zona, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return {
      hora: (v: any) => (v ? h.format(new Date(v)) : null),
      fechaHora: (v: any) => (v ? fh.format(new Date(v)) : null),
    };
  };

  /** Días de estancia contados como en la factura: día calendario iniciado. */
  const diasDeEstancia = (h: any, zona: string, ahora = new Date()): number => {
    const desde = diaEnZona(h.admittedAt, zona);
    const hasta = diaEnZona(h.dischargedAt ?? ahora, zona);
    let n = 1;
    for (let d = desde; d < hasta && n < 3660; d = diaSiguiente(d)) n++;
    return n;
  };

  async function exigirHospitalizacion(documentId: string, populate: any = {}): Promise<any> {
    const h: any = await strapi.documents(HOSPITALIZACION as any).findOne({ documentId, populate } as any);
    if (!h) throw new ValidationError('La hospitalización no existe');
    return h;
  }

  /** Tomas pendientes y atrasadas de las órdenes activas, para el tablero. */
  async function alertasDe(hospitalizacionIds: string[], ahora: number) {
    const resultado = new Map<string, { atrasadas: number; proximas: number }>();
    if (hospitalizacionIds.length === 0) return resultado;
    const desde = ahora - 24 * 3600_000;
    const hasta = ahora + 2 * 3600_000;
    const [ordenes, tomas]: any[] = await Promise.all([
      strapi.documents(ORDEN as any).findMany({
        filters: { hospitalization: { documentId: { $in: hospitalizacionIds } }, state: 'active' } as any,
        populate: { hospitalization: { fields: ['documentId', 'admittedAt'] } } as any,
        limit: 1000,
      } as any),
      strapi.documents(ADMINISTRACION as any).findMany({
        filters: {
          hospitalization: { documentId: { $in: hospitalizacionIds } },
          scheduledFor: { $gte: new Date(desde).toISOString(), $lte: new Date(hasta).toISOString() },
        } as any,
        fields: ['scheduledFor', 'state'] as any,
        populate: { order: { fields: ['documentId'] } } as any,
        limit: 5000,
      } as any),
    ]);
    const hechas = new Set((tomas as any[]).map((t) => `${t.order?.documentId}|${ms(t.scheduledFor)}`));
    for (const o of ordenes as any[]) {
      const id = o.hospitalization?.documentId;
      const r = resultado.get(id) ?? { atrasadas: 0, proximas: 0 };
      for (const t of programarTomas(o, desde, hasta)) {
        if (hechas.has(`${o.documentId}|${t}`)) continue;
        if (ahora > t + MINUTOS_DE_GRACIA * 60_000) r.atrasadas++;
        else r.proximas++;
      }
      resultado.set(id, r);
    }
    return resultado;
  }

  /** `hora` opcional "HH:mm" del día `dia` (zona de Clínica); sin ella, el servidor pone ahora. */
  async function instante(dia?: string, hora?: string): Promise<string | undefined> {
    if (!hora) return undefined;
    if (!HORA.test(hora) || !esDia(dia)) throw new ValidationError('La hora va como HH:mm y el día como AAAA-MM-DD');
    const [hh, mm] = hora.split(':').map(Number);
    const zona = await hosp().zona();
    return new Date(inicioDelDia(dia as string, zona).getTime() + (hh * 60 + mm) * 60_000).toISOString();
  }

  return {
    /** Lo que la página necesita saber antes de pintar nada (H1). */
    async estado() {
      const habilitada = await hosp().habilitada();
      return { habilitada, zona: await hosp().zona() };
    },

    /**
     * Tablero: salas de hospitalización con sus jaulas y quién ocupa cada una,
     * y las altas de los últimos 7 días.
     */
    async tablero() {
      const zona = await hosp().zona();
      const f = formateadores(zona);
      const ahora = Date.now();

      const [jaulas, activas, altas]: any[] = await Promise.all([
        strapi.documents(JAULA as any).findMany({
          populate: { room: { fields: ['name', 'roomType', 'isActive'] }, dailyService: { fields: ['name'] } } as any,
          sort: ['sortOrder:asc', 'name:asc'],
          limit: 500,
        } as any),
        strapi.documents(HOSPITALIZACION as any).findMany({
          filters: { state: 'active' } as any,
          populate: {
            pet: { fields: ['name', 'sex', 'weightKg'], populate: { species: { fields: ['name'] }, breed: { fields: ['name'] }, owner: { populate: { profile: { fields: ['firstName', 'lastName'] } } } } },
            cage: { fields: ['documentId'] },
            responsibleVet: { fields: ['firstname', 'lastname'] },
          } as any,
          sort: 'admittedAt:asc',
          limit: 500,
        } as any),
        strapi.documents(HOSPITALIZACION as any).findMany({
          filters: { state: 'discharged', dischargedAt: { $gte: new Date(ahora - 7 * 86400_000).toISOString() } } as any,
          populate: { pet: { fields: ['name'] }, cage: { fields: ['name'] } } as any,
          sort: 'dischargedAt:desc',
          limit: 50,
        } as any),
      ]);

      const alertas = await alertasDe(activas.map((h: any) => h.documentId), ahora);
      const alergias: any[] = activas.length === 0 ? [] : await strapi.documents('api::clinical.allergy').findMany({
        filters: { pet: { documentId: { $in: activas.map((h: any) => h.pet?.documentId).filter(Boolean) } }, isActive: true } as any,
        fields: ['allergen', 'severity'] as any,
        populate: { pet: { fields: ['documentId'] } } as any,
        limit: 1000,
      } as any);

      const aPaciente = (h: any) => ({
        documentId: h.documentId,
        mascota: h.pet ? { documentId: h.pet.documentId, nombre: h.pet.name, especie: h.pet.species?.name ?? null, raza: h.pet.breed?.name ?? null } : null,
        propietario: nombre(h.pet?.owner?.profile),
        veterinario: cuenta(h.responsibleVet),
        ingreso: h.admittedAt,
        ingresoTexto: f.fechaHora(h.admittedAt),
        dias: diasDeEstancia(h, zona),
        motivo: h.reason,
        alergias: alergias.filter((a) => a.pet?.documentId === h.pet?.documentId).map((a) => a.allergen),
        ...(alertas.get(h.documentId) ?? { atrasadas: 0, proximas: 0 }),
      });

      const porJaula = new Map(activas.filter((h: any) => h.cage?.documentId).map((h: any) => [h.cage.documentId, h]));
      const salas = new Map<string, any>();
      for (const j of jaulas) {
        const clave = j.room?.documentId ?? 'sin-sala';
        if (!salas.has(clave)) salas.set(clave, { documentId: j.room?.documentId ?? null, nombre: j.room?.name ?? 'Sin sala', jaulas: [] });
        const ocupante = porJaula.get(j.documentId);
        salas.get(clave).jaulas.push({
          documentId: j.documentId,
          nombre: j.name,
          tamano: j.size,
          tipo: j.cageType,
          activa: j.isActive !== false,
          servicioDiario: j.dailyService?.name ?? null,
          paciente: ocupante ? aPaciente(ocupante) : null,
        });
      }

      return {
        zona,
        ahora: new Date(ahora).toISOString(),
        salas: [...salas.values()],
        resumen: {
          ingresados: activas.length,
          libres: jaulas.filter((j: any) => j.isActive !== false && !porJaula.has(j.documentId)).length,
          atrasadas: [...alertas.values()].reduce((s, a) => s + a.atrasadas, 0),
        },
        altasRecientes: altas.map((h: any) => ({
          documentId: h.documentId,
          mascota: h.pet?.name ?? null,
          jaula: h.cage?.name ?? null,
          alta: h.dischargedAt,
          altaTexto: f.fechaHora(h.dischargedAt),
          tipo: h.dischargeType,
        })),
      };
    },

    /**
     * Hoja de evolución de un día (AAAA-MM-DD en la zona de Clínica; por
     * defecto hoy, o el día del alta si ya salió).
     */
    async hoja(documentId: string, dia?: string) {
      const zona = await hosp().zona();
      const f = formateadores(zona);
      const ahora = Date.now();
      const h = await exigirHospitalizacion(documentId, {
        pet: {
          populate: {
            species: { fields: ['name'] },
            breed: { fields: ['name'] },
            owner: { populate: { profile: { populate: { contacts: { fields: ['contactType', 'value', 'isPrimary'] } } } } },
          },
        },
        cage: { populate: { room: { fields: ['name'] } } },
        cageStays: { populate: { cage: { fields: ['name'] } } },
        responsibleVet: { fields: ['firstname', 'lastname'] },
        admittedBy: { fields: ['firstname', 'lastname'] },
        dischargedBy: { fields: ['firstname', 'lastname'] },
        consultation: { fields: ['consultedAt', 'reason'] },
        dischargeMedications: true,
      });

      const primerDia = diaEnZona(h.admittedAt, zona);
      const ultimoDia = diaEnZona(h.dischargedAt ?? new Date(ahora), zona);
      let elegido = esDia(dia) ? dia : ultimoDia;
      if (elegido < primerDia) elegido = primerDia;
      if (elegido > ultimoDia) elegido = ultimoDia;
      const desde = inicioDelDia(elegido, zona).getTime();
      const hasta = inicioDelDia(diaSiguiente(elegido), zona).getTime();
      const finEstancia = h.state === 'discharged' ? ms(h.dischargedAt) : null;

      const filtroH = { hospitalization: { documentId } };
      const [ordenes, tomas, signos, alergias, clinica]: any[] = await Promise.all([
        strapi.documents(ORDEN as any).findMany({
          filters: filtroH as any,
          populate: { product: { fields: ['name', 'saleUnit', 'presentation'] }, prescribedBy: { fields: ['firstname', 'lastname'] } } as any,
          sort: 'startAt:asc',
          limit: 500,
        } as any),
        strapi.documents(ADMINISTRACION as any).findMany({
          filters: {
            ...filtroH,
            $or: [
              { scheduledFor: { $gte: new Date(desde).toISOString(), $lt: new Date(hasta).toISOString() } },
              { scheduledFor: { $null: true }, administeredAt: { $gte: new Date(desde).toISOString(), $lt: new Date(hasta).toISOString() } },
            ],
          } as any,
          populate: {
            order: { fields: ['documentId'] },
            product: { fields: ['name', 'saleUnit'] },
            administeredBy: { fields: ['firstname', 'lastname'] },
          } as any,
          sort: 'administeredAt:asc',
          limit: 2000,
        } as any),
        strapi.documents(EVOLUCION as any).findMany({
          filters: { ...filtroH, recordedAt: { $gte: new Date(desde).toISOString(), $lt: new Date(hasta).toISOString() } } as any,
          populate: { recordedBy: { fields: ['firstname', 'lastname'] } } as any,
          sort: 'recordedAt:asc',
          limit: 500,
        } as any),
        h.pet
          ? strapi.documents('api::clinical.allergy').findMany({
              filters: { pet: { documentId: h.pet.documentId }, isActive: true } as any,
              fields: ['allergen', 'severity', 'reaction', 'category'] as any,
            } as any)
          : [],
        // Para el encabezado del resumen de alta impreso.
        strapi.db.query('api::clinic.clinic').findOne({ select: ['legalName', 'tradeName', 'phone', 'emergencyPhone'] }),
      ]);

      const aToma = (a: any) => ({
        documentId: a.documentId,
        estado: a.state,
        hora: horaEnZona(a.administeredAt, zona),
        horaTexto: f.hora(a.administeredAt),
        cantidad: Number(a.quantity),
        motivoOmision: a.omissionReason ?? null,
        notas: a.notes ?? null,
        por: cuenta(a.administeredBy),
        producto: a.product?.name ?? null,
      });

      const porOrden = new Map<string, any[]>();
      for (const t of tomas) {
        const id = t.order?.documentId ?? '';
        if (!porOrden.has(id)) porOrden.set(id, []);
        porOrden.get(id)!.push(t);
      }

      // Una orden sale en la hoja del día si estuvo vigente algún momento de ese día.
      const vigentes = ordenes.filter((o: any) => {
        const inicio = ms(o.startAt) as number;
        const fin = Math.min(ms(o.endAt) ?? Infinity, finEstancia ?? Infinity);
        return inicio < hasta && fin > desde;
      });

      const filasDeOrdenes = vigentes.map((o: any) => {
        const propias = porOrden.get(o.documentId) ?? [];
        const programadas = programarTomas(o, desde, hasta, finEstancia).map((t) => {
          const adm = propias.find((a) => a.scheduledFor && Math.abs((ms(a.scheduledFor) as number) - t) < 1000 && a.state === 'given')
            ?? propias.find((a) => a.scheduledFor && Math.abs((ms(a.scheduledFor) as number) - t) < 1000);
          return {
            programada: new Date(t).toISOString(),
            hora: horaEnZona(new Date(t), zona),
            horaTexto: f.hora(t),
            estado: estadoDeToma(t, adm, ahora),
            administracion: adm ? aToma(adm) : null,
          };
        });
        return {
          documentId: o.documentId,
          producto: o.product ? { documentId: o.product.documentId, nombre: o.product.name, unidad: o.product.saleUnit, presentacion: o.product.presentation ?? null } : null,
          dosis: o.dose ?? null,
          cantidadPorToma: Number(o.doseQuantity),
          via: o.route,
          cadaHoras: o.frequencyHours ?? null,
          siEsNecesario: o.isPrn === true,
          desde: o.startAt,
          desdeTexto: f.fechaHora(o.startAt),
          hasta: o.endAt ?? null,
          hastaTexto: f.fechaHora(o.endAt),
          estado: o.state,
          notas: o.notes ?? null,
          prescritaPor: cuenta(o.prescribedBy),
          tomas: programadas,
          // Lo que se dio sin toma programada (orden "si es necesario").
          adicionales: propias.filter((a) => !a.scheduledFor).map(aToma),
        };
      });

      const perfil = h.pet?.owner?.profile;
      const telefono = (perfil?.contacts ?? []).filter((c: any) => c.contactType !== 'email' && c.contactType !== 'email_work')
        .sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary))[0]?.value ?? null;

      const todasLasTomas = filasDeOrdenes.flatMap((o: any) => o.tomas);
      return {
        zona,
        ahora: new Date(ahora).toISOString(),
        dia: elegido,
        diaAnterior: elegido > primerDia ? diaEnZona(new Date(desde - 3600_000), zona) : null,
        diaSiguiente: elegido < ultimoDia ? diaSiguiente(elegido) : null,
        esHoy: elegido === diaEnZona(new Date(ahora), zona),
        hospitalizacion: {
          documentId: h.documentId,
          estado: h.state,
          ingreso: h.admittedAt,
          ingresoTexto: f.fechaHora(h.admittedAt),
          dias: diasDeEstancia(h, zona),
          motivo: h.reason,
          notasIngreso: bloquesATexto(h.admissionNotes),
          jaula: h.cage ? { documentId: h.cage.documentId, nombre: h.cage.name, sala: h.cage.room?.name ?? null } : null,
          veterinario: cuenta(h.responsibleVet),
          ingresadoPor: cuenta(h.admittedBy),
          consulta: h.consultation ? { documentId: h.consultation.documentId, fecha: h.consultation.consultedAt, motivo: h.consultation.reason } : null,
          traslados: (h.cageStays ?? []).map((t: any) => ({ jaula: t.cage?.name ?? null, desde: f.fechaHora(t.fromAt), hasta: f.fechaHora(t.toAt) })),
          alta: h.state === 'discharged'
            ? {
                fecha: h.dischargedAt,
                fechaTexto: f.fechaHora(h.dischargedAt),
                tipo: h.dischargeType,
                por: cuenta(h.dischargedBy),
                resumen: bloquesATexto(h.dischargeSummary),
                indicaciones: bloquesATexto(h.homeInstructions),
                medicacion: (h.dischargeMedications ?? []).map(({ id, ...m }: any) => m),
                control: h.followUpOn ?? null,
              }
            : null,
        },
        mascota: h.pet
          ? {
              documentId: h.pet.documentId,
              nombre: h.pet.name,
              especie: h.pet.species?.name ?? null,
              raza: h.pet.breed?.name ?? null,
              sexo: h.pet.sex ?? null,
              nacimiento: h.pet.birthDate ?? null,
              pesoKg: h.pet.weightKg ?? null,
            }
          : null,
        propietario: perfil ? { nombre: nombre(perfil), telefono } : null,
        clinica: clinica
          ? { nombre: clinica.tradeName || clinica.legalName, telefono: clinica.phone ?? null, urgencias: clinica.emergencyPhone ?? null }
          : null,
        alergias: alergias.map((a: any) => ({ alergeno: a.allergen, gravedad: a.severity, reaccion: a.reaction ?? null, categoria: a.category ?? null })),
        ordenes: filasDeOrdenes,
        dosisUnicas: (porOrden.get('') ?? []).map(aToma),
        signos: signos.map((s: any) => ({
          documentId: s.documentId,
          hora: horaEnZona(s.recordedAt, zona),
          horaTexto: f.hora(s.recordedAt),
          temperatura: s.temperatureC ?? null,
          fc: s.heartRateBpm ?? null,
          fr: s.respiratoryRateRpm ?? null,
          mucosas: s.mucousMembranes ?? null,
          tllc: s.capillaryRefillSeconds ?? null,
          hidratacion: s.hydrationState ?? null,
          pesoKg: s.weightKg ?? null,
          dolor: s.painScore ?? null,
          estadoMental: s.mentation ?? null,
          apetito: s.appetite ?? null,
          orino: s.urinated ?? null,
          defeco: s.defecated ?? null,
          vomito: s.vomited ?? null,
          notas: s.notes ?? null,
          por: cuenta(s.recordedBy),
        })),
        resumen: {
          dadas: todasLasTomas.filter((t: any) => t.estado === 'dada').length,
          omitidas: todasLasTomas.filter((t: any) => t.estado === 'omitida').length,
          atrasadas: todasLasTomas.filter((t: any) => t.estado === 'atrasada').length,
          pendientes: todasLasTomas.filter((t: any) => t.estado === 'pendiente').length,
        },
      };
    },

    // ---- búsquedas para los formularios ------------------------------------

    /** Mascotas por nombre, dueño o documento (vía `searchLabel`), con si ya están ingresadas. */
    async buscarMascotas(q?: string) {
      const t = texto(q);
      if (!t) return [];
      const mascotas: any[] = await strapi.documents('api::pet.pet').findMany({
        filters: { searchLabel: { $containsi: t } } as any,
        fields: ['searchLabel', 'name'] as any,
        sort: ['name:asc'],
        limit: 15,
      } as any);
      const ingresadas: any[] = mascotas.length === 0 ? [] : await strapi.documents(HOSPITALIZACION as any).findMany({
        filters: { state: 'active', pet: { documentId: { $in: mascotas.map((m) => m.documentId) } } } as any,
        populate: { pet: { fields: ['documentId'] }, cage: { fields: ['name'] } } as any,
      } as any);
      return mascotas.map((m) => {
        const ya = ingresadas.find((h) => h.pet?.documentId === m.documentId);
        return { documentId: m.documentId, etiqueta: m.searchLabel || m.name, hospitalizada: ya ? { documentId: ya.documentId, jaula: ya.cage?.name ?? null } : null };
      });
    },

    /** Jaulas activas sin paciente. */
    async jaulasLibres() {
      const [jaulas, activas]: any[] = await Promise.all([
        strapi.documents(JAULA as any).findMany({
          filters: { isActive: { $ne: false } } as any,
          populate: { room: { fields: ['name'] }, dailyService: { fields: ['name'] } } as any,
          sort: ['sortOrder:asc', 'name:asc'],
          limit: 500,
        } as any),
        strapi.documents(HOSPITALIZACION as any).findMany({ filters: { state: 'active' } as any, populate: { cage: { fields: ['documentId'] } } as any, limit: 500 } as any),
      ]);
      const ocupadas = new Set(activas.map((h: any) => h.cage?.documentId));
      return jaulas
        .filter((j: any) => !ocupadas.has(j.documentId))
        .map((j: any) => ({ documentId: j.documentId, nombre: j.name, sala: j.room?.name ?? null, tamano: j.size, tipo: j.cageType, servicioDiario: j.dailyService?.name ?? null }));
    },

    /** Cuentas del panel activas, para elegir al veterinario responsable. */
    async veterinarios() {
      const cuentas: any[] = await strapi.db.query('admin::user').findMany({
        where: { isActive: true, blocked: false },
        select: ['documentId', 'firstname', 'lastname', 'email'],
        populate: { roles: { select: ['name'] } },
        orderBy: { firstname: 'asc' },
      });
      // Primero quien tiene un rol clínico; el resto (Super Admin…) detrás.
      const clinico = (c: any) => (c.roles ?? []).some((r: any) => ['Veterinario', 'Administrador de clínica'].includes(r.name));
      return cuentas
        .sort((a, b) => Number(clinico(b)) - Number(clinico(a)))
        .map((c) => ({ documentId: c.documentId, nombre: cuenta(c), correo: c.email, clinico: clinico(c) }));
    },

    /** Productos que se pueden prescribir o administrar. */
    async productos(q?: string) {
      const t = texto(q);
      const productos: any[] = await strapi.documents('api::catalog.product').findMany({
        filters: { isActive: { $ne: false }, productType: { $in: PRESCRIBIBLES }, ...(t ? { searchLabel: { $containsi: t } } : {}) } as any,
        fields: ['name', 'searchLabel', 'saleUnit', 'productType'] as any,
        sort: ['name:asc'],
        limit: 20,
      } as any);
      return productos.map((p) => ({ documentId: p.documentId, nombre: p.searchLabel || p.name, unidad: p.saleUnit, tipo: p.productType }));
    },

    /** Hospitalización activa de una mascota (o la de una consulta), para los paneles laterales. */
    async deMascota(petId: string) {
      const zona = await hosp().zona();
      const f = formateadores(zona);
      const [activa, ultimas]: any[] = await Promise.all([
        strapi.documents(HOSPITALIZACION as any).findFirst({
          filters: { state: 'active', pet: { documentId: petId } } as any,
          populate: { cage: { fields: ['name'] } } as any,
        } as any),
        strapi.documents(HOSPITALIZACION as any).findMany({
          filters: { state: 'discharged', pet: { documentId: petId } } as any,
          fields: ['admittedAt', 'dischargedAt', 'dischargeType'] as any,
          sort: 'admittedAt:desc',
          limit: 3,
        } as any),
      ]);
      return {
        activa: activa
          ? { documentId: activa.documentId, jaula: activa.cage?.name ?? null, ingresoTexto: f.fechaHora(activa.admittedAt), dias: diasDeEstancia(activa, zona) }
          : null,
        anteriores: ultimas.map((h: any) => ({ documentId: h.documentId, ingresoTexto: f.fechaHora(h.admittedAt), altaTexto: f.fechaHora(h.dischargedAt), tipo: h.dischargeType })),
      };
    },

    async mascotaDeConsulta(consultaId: string): Promise<string | null> {
      const c: any = await strapi.documents('api::clinical.consultation').findOne({
        documentId: consultaId,
        populate: { pet: { fields: ['documentId'] } } as any,
      } as any);
      return c?.pet?.documentId ?? null;
    },

    // ---- escrituras ---------------------------------------------------------

    async ingresar({ mascota, jaula, veterinario, motivo, notas, consulta }: any) {
      if (!mascota || !jaula || !veterinario) throw new ValidationError('Indica mascota, jaula y veterinario responsable');
      if (!texto(motivo)) throw new ValidationError('Indica el motivo del ingreso');
      const h: any = await strapi.documents(HOSPITALIZACION as any).create({
        data: {
          pet: mascota,
          cage: jaula,
          responsibleVet: veterinario,
          reason: texto(motivo),
          admissionNotes: textoABloques(notas),
          ...(consulta ? { consultation: consulta } : {}),
        } as any,
      } as any);
      return { documentId: h.documentId };
    },

    async prescribir(hospitalizacionId: string, { producto, dosis, cantidadPorToma, via, cadaHoras, siEsNecesario, desde, notas }: any) {
      await exigirHospitalizacion(hospitalizacionId);
      const o: any = await strapi.documents(ORDEN as any).create({
        data: {
          hospitalization: hospitalizacionId,
          product: producto,
          dose: texto(dosis),
          doseQuantity: cantidadPorToma === undefined || cantidadPorToma === '' ? 1 : Number(cantidadPorToma),
          route: via || 'oral',
          frequencyHours: siEsNecesario ? null : Number(cadaHoras) || null,
          isPrn: Boolean(siEsNecesario),
          ...(desde ? { startAt: desde } : {}),
          notes: texto(notas),
        } as any,
      } as any);
      return { documentId: o.documentId };
    },

    /** Suspender una orden (desde ahora). Cambiar la dosis = suspender y prescribir otra. */
    async suspenderOrden(ordenId: string, { motivo }: any) {
      const o: any = await strapi.documents(ORDEN as any).findOne({ documentId: ordenId, populate: { hospitalization: { fields: ['documentId'] } } as any } as any);
      if (!o) throw new ValidationError('La orden no existe');
      if (o.state !== 'active') throw new ValidationError('La orden ya no está activa');
      const nota = texto(motivo);
      await strapi.documents(ORDEN as any).update({
        documentId: ordenId,
        data: {
          state: 'suspended',
          endAt: new Date().toISOString(),
          ...(nota ? { notes: [o.notes, `Suspendida: ${nota}`].filter(Boolean).join('\n') } : {}),
        } as any,
      } as any);
      return { hospitalizacion: o.hospitalization?.documentId };
    },

    async registrarSignos(hospitalizacionId: string, datos: any) {
      await exigirHospitalizacion(hospitalizacionId);
      const n = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v));
      const b = (v: any) => (v === true || v === false ? v : null);
      const recordedAt = await instante(datos.dia, datos.hora);
      const e: any = await strapi.documents(EVOLUCION as any).create({
        data: {
          hospitalization: hospitalizacionId,
          ...(recordedAt ? { recordedAt } : {}),
          temperatureC: n(datos.temperatura),
          heartRateBpm: n(datos.fc),
          respiratoryRateRpm: n(datos.fr),
          mucousMembranes: datos.mucosas || null,
          capillaryRefillSeconds: n(datos.tllc),
          hydrationState: datos.hidratacion || null,
          weightKg: n(datos.pesoKg),
          painScore: n(datos.dolor),
          mentation: datos.estadoMental || null,
          appetite: datos.apetito || null,
          urinated: b(datos.orino),
          defecated: b(datos.defeco),
          vomited: b(datos.vomito),
          notes: texto(datos.notas),
        } as any,
      } as any);
      return { documentId: e.documentId };
    },

    async registrarToma(hospitalizacionId: string, { orden, producto, programada, estado, motivo, cantidad, notas, dia, hora }: any) {
      await exigirHospitalizacion(hospitalizacionId);
      const administeredAt = await instante(dia, hora);
      const a: any = await strapi.documents(ADMINISTRACION as any).create({
        data: {
          hospitalization: hospitalizacionId,
          ...(orden ? { order: orden } : { product: producto }),
          ...(programada ? { scheduledFor: programada } : {}),
          ...(administeredAt ? { administeredAt } : {}),
          state: estado === 'omitted' ? 'omitted' : 'given',
          omissionReason: texto(motivo),
          ...(cantidad !== undefined && cantidad !== null && cantidad !== '' ? { quantity: Number(cantidad) } : {}),
          notes: texto(notas),
        } as any,
      } as any);
      return { documentId: a.documentId };
    },

    async trasladar(hospitalizacionId: string, { jaula }: any) {
      if (!jaula) throw new ValidationError('Indica la jaula de destino');
      const h = await exigirHospitalizacion(hospitalizacionId, { cage: { fields: ['documentId'] } });
      if (h.state !== 'active') throw new ValidationError('Solo se traslada a un paciente ingresado');
      if (h.cage?.documentId === jaula) throw new ValidationError('El paciente ya está en esa jaula');
      await strapi.documents(HOSPITALIZACION as any).update({ documentId: hospitalizacionId, data: { cage: jaula } as any } as any);
      return { documentId: hospitalizacionId };
    },

    async darAlta(hospitalizacionId: string, { tipo, resumen, indicaciones, medicacion, control }: any) {
      const h = await exigirHospitalizacion(hospitalizacionId);
      if (h.state !== 'active') throw new ValidationError('La hospitalización ya tiene el alta');
      const meds = (Array.isArray(medicacion) ? medicacion : [])
        .filter((m: any) => texto(m?.drug))
        .map((m: any) => ({
          drug: texto(m.drug),
          dose: texto(m.dose),
          route: m.route || 'oral',
          frequencyHours: m.frequencyHours ? Number(m.frequencyHours) : null,
          durationDays: m.durationDays ? Number(m.durationDays) : null,
          notes: texto(m.notes),
        }));
      await strapi.documents(HOSPITALIZACION as any).update({
        documentId: hospitalizacionId,
        data: {
          state: 'discharged',
          dischargeType: tipo,
          dischargeSummary: textoABloques(resumen),
          homeInstructions: textoABloques(indicaciones),
          dischargeMedications: meds,
          followUpOn: esDia(control) ? control : null,
        } as any,
      } as any);
      return { documentId: hospitalizacionId };
    },
  };
};
