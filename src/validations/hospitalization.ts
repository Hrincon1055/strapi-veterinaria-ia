import { randomUUID } from 'node:crypto';
import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  effective,
  effectiveRelation,
  esDiferenciaVacia,
  loadCurrent,
  on,
  toDocumentId,
} from './helpers';
import { cuentaDelPanel } from './actor';
import { diasConServicio } from '../api/hospitalization/domain/estancia';
import { programarTomas } from '../api/hospitalization/domain/tomas';
import { ms } from '../api/hospitalization/domain/tiempo';

/**
 * Hospitalización (sección 5.6 del documento de modelo).
 *
 * Las reglas viven aquí y no en el plugin del panel: el veterinario también
 * escribe por el Content Manager, y el plugin escribe por el Document Service.
 * Así la página, el formulario y cualquier integración aplican lo mismo.
 */

const HOSPITALIZACION = 'api::hospitalization.hospitalization';
const JAULA = 'api::hospitalization.cage';
const ORDEN = 'api::hospitalization.treatment-order';
const EVOLUCION = 'api::hospitalization.evolution-entry';
const ADMINISTRACION = 'api::hospitalization.medication-administration';

/** Margen para relojes que no van exactamente a la par (navegador frente a servidor). */
const TOLERANCIA_MS = 5 * 60_000;

/** Tipos de producto que se pueden prescribir y administrar. */
const PRESCRIBIBLES = ['medication', 'vaccine', 'supply'];

/** Lo único que cambia en una hospitalización dada de alta (H7). */
const EDITABLE_TRAS_ALTA = ['dischargeSummary', 'homeInstructions', 'dischargeMedications', 'followUpOn', 'searchLabel'];

const POPULATE_ESTANCIA = {
  cage: { populate: { dailyService: true } },
  cageStays: { populate: { cage: { populate: { dailyService: true } } } },
};

const fechaHora = (v: number | string | Date): string => new Date(v).toISOString().slice(0, 16).replace('T', ' ');

const sinIds = (v: any): any => JSON.parse(JSON.stringify(v ?? null, (k, x) => (k === 'id' || k === '__component' ? undefined : x)));

/** ¿El campo cambia frente a lo guardado? El panel reenvía el formulario entero. */
function cambia(campo: string, valor: any, actual: any): boolean {
  if (valor === undefined) return false;
  const guardado = actual?.[campo];
  if (valor && typeof valor === 'object' && !Array.isArray(valor) && (valor.connect || valor.disconnect || valor.set)) {
    if (esDiferenciaVacia(valor)) return false;
    return (toDocumentId(valor) ?? null) !== (guardado?.documentId ?? null);
  }
  if (Array.isArray(valor) || (valor && typeof valor === 'object')) {
    return JSON.stringify(sinIds(valor)) !== JSON.stringify(sinIds(guardado));
  }
  const a = valor === null || valor === '' ? null : valor;
  const b = guardado === undefined || guardado === '' ? null : guardado;
  if (a === b) return false;
  const ta = ms(a);
  const tb = ms(b);
  if (typeof a === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(a) && ta !== null && ta === tb) return false;
  return String(a) !== String(b);
}

/** ¿Un campo `blocks` tiene algún texto? */
const tieneTexto = (bloques: any): boolean =>
  JSON.stringify(bloques ?? []).match(/"text"\s*:\s*"[^"]*\S[^"]*"/) !== null;

const nombreDeFactura = (f: any): string => (f?.fullNumber ? `la factura ${f.fullNumber}` : 'un borrador de factura');

async function exigirDentroDeLaEstancia(h: any, instante: number, que: string): Promise<void> {
  const desde = ms(h.admittedAt);
  const hasta = h.state === 'discharged' ? ms(h.dischargedAt) : Date.now() + TOLERANCIA_MS;
  if (instante > Date.now() + TOLERANCIA_MS) {
    throw new ValidationError(`${que} no puede ser futura (${fechaHora(instante)})`);
  }
  if (desde !== null && instante < desde - TOLERANCIA_MS) {
    throw new ValidationError(`${que} (${fechaHora(instante)}) es anterior al ingreso (${fechaHora(desde)})`);
  }
  if (hasta !== null && instante > hasta + TOLERANCIA_MS) {
    throw new ValidationError(`${que} (${fechaHora(instante)}) es posterior al alta (${fechaHora(hasta)})`);
  }
}

export default (strapi: Core.Strapi): void => {
  const svc = () => strapi.service(HOSPITALIZACION as any) as any;

  const cargarHospitalizacion = (documentId: string, populate: any = {}) =>
    strapi.documents(HOSPITALIZACION as any).findOne({ documentId, populate } as any) as Promise<any>;

  /** Otra hospitalización activa que cumpla el filtro, sin contar esta. */
  const otraActiva = (filtro: any, documentId?: string) =>
    strapi.documents(HOSPITALIZACION as any).findFirst({
      filters: { state: 'active', ...filtro, ...(documentId ? { documentId: { $ne: documentId } } : {}) } as any,
      populate: { pet: { fields: ['name'] }, cage: { fields: ['name'] } } as any,
    } as any) as Promise<any>;

  /** Jaula utilizable para un ingreso o un traslado. */
  async function exigirJaulaLibre(cageId: string, hospitalizacionId?: string): Promise<any> {
    const jaula: any = await strapi.documents(JAULA as any).findOne({
      documentId: cageId,
      populate: { room: { fields: ['roomType', 'name'] }, dailyService: true } as any,
    } as any);
    if (!jaula) throw new ValidationError('La jaula indicada no existe');
    if (jaula.isActive === false) throw new ValidationError(`La jaula "${jaula.name}" está desactivada`);
    const ocupada = await otraActiva({ cage: { documentId: cageId } }, hospitalizacionId);
    if (ocupada) {
      throw new ValidationError(`La jaula "${jaula.name}" está ocupada por ${ocupada.pet?.name ?? 'otro paciente'}`);
    }
    return jaula;
  }

  // ---- api::hospitalization.cage --------------------------------------------

  on(strapi, JAULA, ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const actual = await loadCurrent(strapi, ctx, ['room']);

    const salaId = effectiveRelation(data, actual, 'room');
    if (salaId && ('room' in data || ctx.action === 'create')) {
      const sala: any = await strapi.documents('api::scheduling.clinic-room').findOne({ documentId: salaId, fields: ['name', 'roomType'] as any });
      if (!sala) throw new ValidationError('La sala indicada no existe');
      if (sala.roomType !== 'hospitalization') {
        throw new ValidationError(`La sala "${sala.name}" no es de hospitalización (tipo "${sala.roomType}")`);
      }
    }

    if (ctx.action === 'update' && data.isActive === false && actual?.isActive !== false) {
      const ocupada = await otraActiva({ cage: { documentId: ctx.params.documentId } });
      if (ocupada) {
        throw new ValidationError(`No se puede desactivar: la jaula está ocupada por ${ocupada.pet?.name ?? 'un paciente'}`);
      }
    }
    return next();
  });

  on(strapi, JAULA, ['delete'], async (ctx, next) => {
    // También la que solo sale en el historial de traslados: sus días de
    // estancia se cobran con el servicio de esa jaula.
    const id = ctx.params.documentId;
    const usada = await strapi.documents(HOSPITALIZACION as any).count({
      filters: { $or: [{ cage: { documentId: id } }, { cageStays: { cage: { documentId: id } } }] } as any,
    } as any);
    if (usada > 0) throw new ValidationError('Esta jaula ya tiene hospitalizaciones: desactívala en vez de borrarla');
    return next();
  });

  // ---- api::hospitalization.hospitalization ---------------------------------

  on(strapi, HOSPITALIZACION, ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const actual = await loadCurrent(strapi, ctx, { pet: true, consultation: { populate: ['pet'] }, ...POPULATE_ESTANCIA });
    const ahora = new Date().toISOString();

    // `cageStays` es del servidor: lo que llegue se descarta y aquí se decide
    // si hace falta reescribirlo (ingreso, traslado o alta).
    delete data.cageStays;

    const estadoActual: string = actual?.state ?? 'active';
    const estado: string = effective<string>(data, actual, 'state') ?? 'active';

    // --- dada de alta: congelada (H7) ---
    if (ctx.action === 'update' && estadoActual === 'discharged') {
      if (estado !== 'discharged') throw new ValidationError('Una hospitalización dada de alta no se reabre: ingresa al paciente de nuevo');
      const tocados = Object.keys(data).filter((k) => cambia(k, data[k], actual));
      const prohibidos = tocados.filter((k) => !EDITABLE_TRAS_ALTA.includes(k));
      if (prohibidos.length > 0) {
        throw new ValidationError(
          `La hospitalización ya tiene el alta: solo cambian ${EDITABLE_TRAS_ALTA.slice(0, -1).join(', ')}; se intentó cambiar: ${prohibidos.join(', ')}`
        );
      }
      ctx.params.data = data;
      return next();
    }

    // --- ingreso ---
    if (ctx.action === 'create') {
      if (!(await svc().habilitada())) {
        throw new ValidationError('La clínica no tiene hospitalización activada (Clínica → "Hospitaliza pacientes")');
      }
      if (estado !== 'active') throw new ValidationError('Una hospitalización nace activa; el alta se da después');
      for (const k of ['dischargeType', 'dischargedAt', 'dischargedBy']) {
        if (data[k] !== undefined && data[k] !== null) throw new ValidationError(`${k} se pone al dar el alta, no al ingresar`);
      }
      if (!data.admittedAt) data.admittedAt = ahora;
    }

    const petId = effectiveRelation(data, actual, 'pet');
    const cageId = effectiveRelation(data, actual, 'cage');
    const admittedAt = effective<string>(data, actual, 'admittedAt');
    const cambiaMascota = ctx.action === 'update' && 'pet' in data && !esDiferenciaVacia(data.pet) && petId !== actual?.pet?.documentId;
    const cambiaJaula = ctx.action === 'update' && 'cage' in data && !esDiferenciaVacia(data.cage) && cageId !== actual?.cage?.documentId;

    if (ms(admittedAt) !== null && (ms(admittedAt) as number) > Date.now() + TOLERANCIA_MS) {
      throw new ValidationError('El ingreso no puede ser futuro');
    }

    if (petId && (ctx.action === 'create' || cambiaMascota)) {
      const mascota = await strapi.documents('api::pet.pet').findOne({ documentId: petId, fields: ['name'] as any });
      if (!mascota) throw new ValidationError('La mascota no existe o está archivada');
      const ya = await otraActiva({ pet: { documentId: petId } }, ctx.params.documentId);
      if (ya) throw new ValidationError(`${(mascota as any).name} ya está hospitalizada (${ya.cage?.name ?? 'sin jaula'})`);
    }
    if (cageId && (ctx.action === 'create' || cambiaJaula)) {
      await exigirJaulaLibre(cageId, ctx.params.documentId);
    }

    const consultaId = effectiveRelation(data, actual, 'consultation');
    if (consultaId && petId && ('consultation' in data || cambiaMascota)) {
      const consulta: any = await strapi.documents('api::clinical.consultation').findOne({
        documentId: consultaId,
        populate: { pet: { fields: ['documentId'] } } as any,
      } as any);
      if (!consulta) throw new ValidationError('La consulta de origen no existe');
      if (consulta.pet?.documentId !== petId) throw new ValidationError('La consulta de origen es de otra mascota');
    }

    // --- alta ---
    const daAlta = estado === 'discharged' && estadoActual !== 'discharged';
    let dischargedAt: string | null = effective<string>(data, actual, 'dischargedAt') ?? null;
    if (daAlta) {
      if (ctx.action === 'create') throw new ValidationError('Una hospitalización nace activa; el alta se da después');
      if (!effective(data, actual, 'dischargeType')) throw new ValidationError('Indica el tipo de alta (dischargeType)');
      if (!dischargedAt) dischargedAt = data.dischargedAt = ahora;
      if ((ms(dischargedAt) as number) < (ms(admittedAt) as number)) throw new ValidationError('El alta no puede ser anterior al ingreso');
      if ((ms(dischargedAt) as number) > Date.now() + TOLERANCIA_MS) throw new ValidationError('El alta no puede ser futura');
      if (effective(data, actual, 'dischargeType') === 'medical' && !tieneTexto(effective(data, actual, 'dischargeSummary'))) {
        throw new ValidationError('Un alta médica necesita el resumen de alta (dischargeSummary)');
      }
      const cuenta = await cuentaDelPanel(strapi);
      if (cuenta) data.dischargedBy = cuenta;
    } else if (estado === 'active') {
      for (const k of ['dischargeType', 'dischargedAt']) {
        if (data[k]) throw new ValidationError(`${k} se pone al dar el alta (estado "discharged")`);
      }
    }

    // --- tramos de jaula: ingreso, traslado y cierre al alta ---
    const tramos: any[] = (actual?.cageStays ?? []).map((t: any) => ({
      id: t.id,
      cage: t.cage?.documentId ?? null,
      fromAt: t.fromAt,
      toAt: t.toAt ?? null,
    }));
    let reescribeTramos = false;
    if (ctx.action === 'create') {
      tramos.push({ cage: cageId, fromAt: data.admittedAt, toAt: null });
      reescribeTramos = true;
    } else if (cambiaJaula) {
      const abierto = tramos.find((t) => !t.toAt);
      if (abierto) abierto.toAt = ahora;
      tramos.push({ cage: cageId, fromAt: ahora, toAt: null });
      reescribeTramos = true;
    } else if (tramos.length === 0 && cageId) {
      // Datos escritos antes de existir los tramos: se abre uno con el ingreso.
      tramos.push({ cage: cageId, fromAt: admittedAt, toAt: null });
      reescribeTramos = true;
    }
    if (ctx.action === 'update' && 'admittedAt' in data && tramos.length > 0 && cambia('admittedAt', data.admittedAt, actual)) {
      tramos[0].fromAt = admittedAt;
      reescribeTramos = true;
    }
    if (daAlta) {
      const abierto = tramos.find((t) => !t.toAt);
      if (abierto) abierto.toAt = dischargedAt;
      reescribeTramos = true;
    }
    if (reescribeTramos) data.cageStays = tramos;

    // --- lo ya registrado y lo ya cobrado no puede quedar fuera ---
    if (ctx.action === 'update') {
      const cambiaInicio = 'admittedAt' in data && cambia('admittedAt', data.admittedAt, actual);
      const cambiaFin = 'dischargedAt' in data && cambia('dischargedAt', data.dischargedAt, actual);

      if (cambiaInicio) {
        const [primerSigno, primeraToma]: any[] = await Promise.all([
          strapi.documents(EVOLUCION as any).findFirst({ filters: { hospitalization: { documentId: ctx.params.documentId } } as any, sort: 'recordedAt:asc' } as any),
          strapi.documents(ADMINISTRACION as any).findFirst({ filters: { hospitalization: { documentId: ctx.params.documentId } } as any, sort: 'administeredAt:asc' } as any),
        ]);
        const primero = Math.min(ms(primerSigno?.recordedAt) ?? Infinity, ms(primeraToma?.administeredAt) ?? Infinity);
        if (Number.isFinite(primero) && (ms(admittedAt) as number) > primero) {
          throw new ValidationError(`El ingreso no puede ser posterior al primer registro de la hoja (${fechaHora(primero)})`);
        }
      }

      if (cambiaMascota || cambiaInicio || cambiaFin || reescribeTramos) {
        const vivos: any[] = await svc().renglonesVivos(ctx.params.documentId);
        if (vivos.length > 0 && cambiaMascota) {
          throw new ValidationError(`Esta hospitalización tiene conceptos en ${nombreDeFactura(vivos[0].invoice)}: no puede cambiar de mascota`);
        }
        const dias = vivos.filter((r) => r.kind === 'hospitalization_stay');
        if (dias.length > 0) {
          // Los días con los datos nuevos, calculados igual que al facturar.
          const { zona, porDefecto } = await svc().contextoDeEstancia();
          const jaulas = new Map<string, any>();
          for (const id of new Set(tramos.map((t) => t.cage).filter(Boolean))) {
            jaulas.set(id, await strapi.documents(JAULA as any).findOne({ documentId: id, populate: ['dailyService'] as any } as any));
          }
          const nuevos = diasConServicio(
            {
              documentId: ctx.params.documentId,
              admittedAt: admittedAt as string,
              dischargedAt: estado === 'discharged' ? dischargedAt : null,
              cage: cageId ? jaulas.get(cageId) : null,
              cageStays: tramos.map((t) => ({ ...t, cage: t.cage ? jaulas.get(t.cage) : null })),
            },
            zona,
            porDefecto
          );
          const porClave = new Map(nuevos.map((d) => [d.lineKey, d]));
          for (const r of dias) {
            const d = porClave.get(r.lockKey);
            if (!d) {
              throw new ValidationError(
                `El día ${String(r.lockKey).split(':')[1]} se está cobrando en ${nombreDeFactura(r.invoice)}: con ese cambio dejaría de ser un día de estancia. Quítalo del borrador o anula la factura antes.`
              );
            }
            if ((d.servicio?.documentId ?? null) !== (r.service?.documentId ?? null)) {
              throw new ValidationError(
                `El día ${d.fecha} se está cobrando en ${nombreDeFactura(r.invoice)} con otro servicio: con ese cambio se cobraría distinto. Quítalo del borrador o anula la factura antes.`
              );
            }
          }
        }
      }
    }

    // Tras comprobar lo cobrado: ese mensaje es el que explica qué hacer.
    if (ctx.action === 'update' && estado === 'discharged' && (daAlta || ('dischargedAt' in data && cambia('dischargedAt', data.dischargedAt, actual)))) {
      const [ultimoSigno, ultimaToma]: any[] = await Promise.all([
        strapi.documents(EVOLUCION as any).findFirst({ filters: { hospitalization: { documentId: ctx.params.documentId } } as any, sort: 'recordedAt:desc' } as any),
        strapi.documents(ADMINISTRACION as any).findFirst({ filters: { hospitalization: { documentId: ctx.params.documentId } } as any, sort: 'administeredAt:desc' } as any),
      ]);
      const ultimo = Math.max(ms(ultimoSigno?.recordedAt) ?? -Infinity, ms(ultimaToma?.administeredAt) ?? -Infinity);
      if (Number.isFinite(ultimo) && (ms(dischargedAt) as number) < ultimo - TOLERANCIA_MS) {
        throw new ValidationError(`El alta no puede ser anterior al último registro de la hoja (${fechaHora(ultimo)})`);
      }
    }

    ctx.params.data = data;
    const resultado = await next();

    // Al alta, las órdenes que seguían activas terminan con ella (H7).
    if (daAlta) {
      const activas: any[] = await strapi.documents(ORDEN as any).findMany({
        filters: { hospitalization: { documentId: ctx.params.documentId }, state: 'active' } as any,
        fields: ['documentId', 'endAt'] as any,
      } as any);
      for (const o of activas) {
        const fin = o.endAt && (ms(o.endAt) as number) < (ms(dischargedAt) as number) ? o.endAt : dischargedAt;
        await strapi.documents(ORDEN as any).update({ documentId: o.documentId, data: { state: 'completed', endAt: fin } as any } as any);
      }
    }
    return resultado;
  });

  on(strapi, HOSPITALIZACION, ['delete'], async (ctx, next) => {
    const id = ctx.params.documentId;
    const vivos: any[] = await svc().renglonesVivos(id);
    if (vivos.length > 0) {
      throw new ValidationError(`Esta hospitalización tiene conceptos en ${nombreDeFactura(vivos[0].invoice)}: no se puede borrar`);
    }
    const filtro = { hospitalization: { documentId: id } };
    const [signos, tomas] = await Promise.all([
      strapi.documents(EVOLUCION as any).count({ filters: filtro } as any),
      strapi.documents(ADMINISTRACION as any).count({ filters: filtro } as any),
    ]);
    if (signos + tomas > 0) {
      throw new ValidationError('La hospitalización tiene registros en la hoja de evolución: es historia clínica y no se borra');
    }
    // Strapi no borra en cascada: las órdenes quedarían huérfanas.
    const ordenes: any[] = await strapi.documents(ORDEN as any).findMany({ filters: filtro, fields: ['documentId'] } as any);
    for (const o of ordenes) await strapi.documents(ORDEN as any).delete({ documentId: o.documentId } as any);
    return next();
  });

  // ---- api::hospitalization.treatment-order ---------------------------------

  on(strapi, ORDEN, ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const actual = await loadCurrent(strapi, ctx, ['hospitalization', 'product']);

    const hospitalizacionId = effectiveRelation(data, actual, 'hospitalization');
    if (!hospitalizacionId) return next(); // `required-relations` lo rechaza.
    if (ctx.action === 'update' && 'hospitalization' in data && !esDiferenciaVacia(data.hospitalization) &&
        hospitalizacionId !== actual?.hospitalization?.documentId) {
      throw new ValidationError('Una orden no se mueve a otra hospitalización');
    }
    const h = await cargarHospitalizacion(hospitalizacionId);
    if (!h) throw new ValidationError('La hospitalización indicada no existe');

    if (ctx.action === 'create') {
      if (h.state !== 'active') throw new ValidationError('No se prescribe en una hospitalización dada de alta');
      if (!data.startAt) data.startAt = new Date().toISOString();
      if (data.state && data.state !== 'active') throw new ValidationError('Una orden nace activa');
    } else if (h.state !== 'active') {
      // Tras el alta solo se cierra (lo hace el alta misma) o se anota.
      const tocados = Object.keys(data).filter((k) => cambia(k, data[k], actual));
      const prohibidos = tocados.filter((k) => !['state', 'endAt', 'notes', 'searchLabel'].includes(k));
      if (prohibidos.length > 0 || (tocados.includes('state') && data.state !== 'completed')) {
        throw new ValidationError('La hospitalización ya tiene el alta: sus órdenes no cambian');
      }
    }

    const productoId = effectiveRelation(data, actual, 'product');
    if (productoId && (ctx.action === 'create' || ('product' in data && !esDiferenciaVacia(data.product)))) {
      if (ctx.action === 'update' && productoId !== actual?.product?.documentId) {
        const tomas = await strapi.documents(ADMINISTRACION as any).count({ filters: { order: { documentId: ctx.params.documentId } } } as any);
        if (tomas > 0) throw new ValidationError('La orden ya tiene tomas registradas: no cambia de producto (suspéndela y prescribe otra)');
      }
      const p: any = await strapi.documents('api::catalog.product').findOne({ documentId: productoId, fields: ['name', 'productType', 'isActive'] as any });
      if (!p) throw new ValidationError('El producto indicado no existe');
      if (p.isActive === false) throw new ValidationError(`"${p.name}" está inactivo en el catálogo`);
      if (!PRESCRIBIBLES.includes(p.productType)) {
        throw new ValidationError(`"${p.name}" es de tipo "${p.productType}": solo se prescriben medicamentos, vacunas e insumos`);
      }
    }

    const isPrn = effective<boolean>(data, actual, 'isPrn') === true;
    const frecuencia = effective<number>(data, actual, 'frequencyHours');
    if (!isPrn && !frecuencia) throw new ValidationError('Indica cada cuántas horas (frequencyHours) o marca "si es necesario" (isPrn)');
    if (isPrn && frecuencia) data.frequencyHours = null;

    const startAt = effective<string>(data, actual, 'startAt');
    const estado = effective<string>(data, actual, 'state') ?? 'active';
    if (estado !== 'active' && !effective(data, actual, 'endAt')) data.endAt = new Date().toISOString();
    const endAt = effective<string>(data, actual, 'endAt');

    const inicio = ms(startAt);
    if (inicio !== null) {
      if (inicio < (ms(h.admittedAt) as number) - TOLERANCIA_MS) throw new ValidationError('La orden no puede empezar antes del ingreso');
      if (h.state === 'discharged' && inicio > (ms(h.dischargedAt) as number)) throw new ValidationError('La orden no puede empezar después del alta');
    }
    if (endAt && inicio !== null && (ms(endAt) as number) <= inicio) {
      throw new ValidationError('El fin de la orden debe ser posterior a su inicio');
    }

    ctx.params.data = data;
    return next();
  });

  on(strapi, ORDEN, ['delete'], async (ctx, next) => {
    const tomas = await strapi.documents(ADMINISTRACION as any).count({ filters: { order: { documentId: ctx.params.documentId } } } as any);
    if (tomas > 0) throw new ValidationError('La orden tiene tomas registradas: suspéndela en vez de borrarla');
    return next();
  });

  // ---- api::hospitalization.evolution-entry ---------------------------------

  on(strapi, EVOLUCION, ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const actual = await loadCurrent(strapi, ctx, ['hospitalization']);

    const hospitalizacionId = effectiveRelation(data, actual, 'hospitalization');
    if (!hospitalizacionId) return next();
    if (ctx.action === 'update' && 'hospitalization' in data && !esDiferenciaVacia(data.hospitalization) &&
        hospitalizacionId !== actual?.hospitalization?.documentId) {
      throw new ValidationError('Un registro de evolución no se mueve a otra hospitalización');
    }
    const h = await cargarHospitalizacion(hospitalizacionId);
    if (!h) throw new ValidationError('La hospitalización indicada no existe');

    if (ctx.action === 'create' && !data.recordedAt) data.recordedAt = new Date().toISOString();
    const recordedAt = ms(effective(data, actual, 'recordedAt'));
    if (recordedAt !== null && (ctx.action === 'create' || 'recordedAt' in data)) {
      await exigirDentroDeLaEstancia(h, recordedAt, 'La hora del registro');
    }
    ctx.params.data = data;
    return next();
  });

  // ---- api::hospitalization.medication-administration -----------------------

  /** Renglón vivo que cobra esta toma, si lo hay. */
  const renglonDeToma = (lineKey: string | null | undefined) =>
    lineKey
      ? (strapi.documents('api::billing.invoice-item').findFirst({
          filters: { lockKey: lineKey } as any,
          populate: { invoice: { fields: ['fullNumber', 'state'] }, product: { fields: ['documentId'] } } as any,
        } as any) as Promise<any>)
      : Promise.resolve(null);

  on(strapi, ADMINISTRACION, ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const actual = await loadCurrent(strapi, ctx, ['hospitalization', 'order', 'product']);

    // La clave de factura es del servidor.
    if (ctx.action === 'create') data.lineKey = randomUUID();
    else delete data.lineKey;

    const hospitalizacionId = effectiveRelation(data, actual, 'hospitalization');
    if (!hospitalizacionId) return next();
    if (ctx.action === 'update') {
      for (const rel of ['hospitalization', 'order'] as const) {
        if (rel in data && !esDiferenciaVacia(data[rel]) && effectiveRelation(data, actual, rel) !== (actual?.[rel]?.documentId ?? null)) {
          throw new ValidationError(`Una toma no cambia de ${rel === 'order' ? 'orden' : 'hospitalización'}: bórrala y regístrala de nuevo`);
        }
      }
    }
    const h = await cargarHospitalizacion(hospitalizacionId);
    if (!h) throw new ValidationError('La hospitalización indicada no existe');

    // --- orden y producto ---
    const ordenId = effectiveRelation(data, actual, 'order');
    let orden: any = null;
    if (ordenId) {
      orden = await strapi.documents(ORDEN as any).findOne({
        documentId: ordenId,
        populate: { hospitalization: { fields: ['documentId'] }, product: { fields: ['documentId', 'name'] } } as any,
      } as any);
      if (!orden) throw new ValidationError('La orden indicada no existe');
      if (orden.hospitalization?.documentId !== hospitalizacionId) throw new ValidationError('Esa orden es de otra hospitalización');
      const pedido = 'product' in data && !esDiferenciaVacia(data.product) ? toDocumentId(data.product) : undefined;
      if (pedido && pedido !== orden.product?.documentId) {
        throw new ValidationError(`La orden es de "${orden.product?.name}": la toma no puede ser de otro producto`);
      }
      data.product = orden.product?.documentId;
      if (ctx.action === 'create' && (data.quantity === undefined || data.quantity === null)) {
        data.quantity = Number(orden.doseQuantity);
      }
    }
    const productoId = effectiveRelation(data, actual, 'product');
    if (!productoId) throw new ValidationError('Indica la orden de tratamiento o, en una dosis única, el producto');
    if (!orden && (ctx.action === 'create' || 'product' in data)) {
      const p: any = await strapi.documents('api::catalog.product').findOne({ documentId: productoId, fields: ['name', 'productType'] as any });
      if (!p) throw new ValidationError('El producto indicado no existe');
      if (!PRESCRIBIBLES.includes(p.productType)) throw new ValidationError(`"${p.name}" no es un medicamento, vacuna ni insumo`);
    }

    // --- momento ---
    if (ctx.action === 'create' && !data.administeredAt) data.administeredAt = new Date().toISOString();
    const administeredAt = ms(effective(data, actual, 'administeredAt'));
    if (administeredAt !== null && (ctx.action === 'create' || 'administeredAt' in data)) {
      await exigirDentroDeLaEstancia(h, administeredAt, 'La hora de la toma');
    }

    // --- toma programada que cubre ---
    const scheduledFor = ms(effective(data, actual, 'scheduledFor'));
    if (scheduledFor !== null && (ctx.action === 'create' || 'scheduledFor' in data)) {
      if (!orden) throw new ValidationError('Una toma programada (scheduledFor) va con su orden');
      const fin = h.state === 'discharged' ? ms(h.dischargedAt) : null;
      const programadas = programarTomas(orden, scheduledFor, scheduledFor + 1000, fin);
      if (!programadas.some((t) => Math.abs(t - scheduledFor) < 1000)) {
        throw new ValidationError(`${fechaHora(scheduledFor)} no es una toma programada de esa orden`);
      }
    }

    // --- estado ---
    const estado = effective<string>(data, actual, 'state') ?? 'given';
    if (estado === 'omitted' && !String(effective(data, actual, 'omissionReason') ?? '').trim()) {
      throw new ValidationError('Una toma omitida necesita el motivo (omissionReason)');
    }

    // H6: no dos tomas dadas para la misma toma programada.
    if (estado === 'given' && orden && scheduledFor !== null) {
      const doble: any = await strapi.documents(ADMINISTRACION as any).findFirst({
        filters: {
          order: { documentId: orden.documentId },
          state: 'given',
          scheduledFor: { $gte: new Date(scheduledFor - 999).toISOString(), $lte: new Date(scheduledFor + 999).toISOString() },
          ...(ctx.params.documentId ? { documentId: { $ne: ctx.params.documentId } } : {}),
        } as any,
        populate: { administeredBy: { fields: ['firstname', 'lastname'] } } as any,
      } as any);
      if (doble) {
        const quien = [doble.administeredBy?.firstname, doble.administeredBy?.lastname].filter(Boolean).join(' ');
        throw new ValidationError(
          `La toma de las ${fechaHora(scheduledFor)} ya se registró como dada${quien ? ` por ${quien}` : ''} a las ${fechaHora(doble.administeredAt)}: no se registra dos veces`
        );
      }
    }

    // --- cobrada: lo que se cobra no cambia ---
    if (ctx.action === 'update') {
      const r = await renglonDeToma(actual?.lineKey);
      if (r) {
        const cambiaCobro =
          productoId !== r.product?.documentId ||
          Number(effective(data, actual, 'quantity')) !== Number(r.quantity) ||
          estado !== 'given';
        if (cambiaCobro) {
          throw new ValidationError(
            `Esta toma se está cobrando en ${nombreDeFactura(r.invoice)}: no cambia de producto, cantidad ni estado. Quítala del borrador o anula la factura antes.`
          );
        }
      }
    }

    ctx.params.data = data;
    return next();
  });

  on(strapi, ADMINISTRACION, ['delete'], async (ctx, next) => {
    const a: any = await strapi.documents(ADMINISTRACION as any).findOne({ documentId: ctx.params.documentId, fields: ['lineKey'] as any } as any);
    const r = await renglonDeToma(a?.lineKey);
    if (r) throw new ValidationError(`Esta toma se está cobrando en ${nombreDeFactura(r.invoice)}: no se puede borrar`);
    return next();
  });
};
