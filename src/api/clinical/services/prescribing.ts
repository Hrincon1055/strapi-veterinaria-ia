import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { enServicioDeFormulas, numeroDeFormula } from '../domain/formula';

const { ValidationError, ForbiddenError, NotFoundError } = errors;

/**
 * Fórmula médica: la receta que se le entrega al propietario a partir del
 * plan de tratamiento de una consulta.
 *
 * La fórmula es un documento propio (`api::clinical.prescription`) y no una
 * vista del plan: lleva consecutivo y una COPIA de los medicamentos y del
 * firmante tomada al emitir. Si después se corrige el plan o el veterinario
 * cambia de tarjeta profesional, la reimpresión sigue diciendo lo que se
 * entregó. Una vez emitida no se edita: se anula y se emite otra.
 *
 * Firma la cuenta de la sesión, no el `vet` de la consulta: lo que sale en el
 * papel es la responsabilidad de quien la emite.
 *
 * Aquí solo se orquesta; las reglas (solo se crea desde aquí, congelada, no
 * se borra) están en `validations/prescription.ts`. La usa el plugin
 * `veterinaria-historia`, igual que la facturación usa `invoicing`.
 */

const FORMULA = 'api::clinical.prescription';
const CONSULTA = 'api::clinical.consultation';
const PERFIL = 'api::identity.profile';

const POPULATE_PLAN = {
  sections: {
    on: {
      'clinical.treatment-plan': {
        populate: {
          medications: {
            populate: {
              product: {
                fields: ['name', 'presentation', 'productType'],
                populate: {
                  details: { on: { 'catalog.medication-details': { populate: ['activeIngredients'] } } },
                },
              },
            },
          },
        },
      },
    },
  },
};

const UNIDADES: Record<string, string> = {
  mg: 'mg', mcg: 'mcg', g: 'g', ui: 'UI', mg_ml: 'mg/ml', mcg_ml: 'mcg/ml', ui_ml: 'UI/ml', percent: '%',
};

const nombre = (p: any): string | null => (p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || null : null);
const documento = (p: any): string | null =>
  p?.documentNumber ? `${String(p.documentType ?? '').toUpperCase()} ${p.documentNumber}`.trim() : null;
const texto = (v: any): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** "1,5": la fórmula se lee en Colombia, con coma decimal. */
const decimal = (v: any): string => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 3 });

/** Datos de medicamento del producto, si los tiene. */
const detalleDe = (producto: any): any =>
  (producto?.details ?? []).find((d: any) => d.__component === 'catalog.medication-details') ?? null;

/** "Meloxicam 1.5 mg/ml + Paracetamol 500 mg". */
function principiosActivos(producto: any): string | null {
  const lista = (detalleDe(producto)?.activeIngredients ?? []).map((a: any) =>
    [a.name, a.strength != null ? `${decimal(a.strength)} ${UNIDADES[a.strengthUnit] ?? a.strengthUnit ?? ''}`.trim() : null]
      .filter(Boolean)
      .join(' ')
  );
  return lista.length ? lista.join(' + ').slice(0, 255) : null;
}

const presentacion = (producto: any): string | null =>
  producto ? [producto.name, producto.presentation].filter(Boolean).join(' · ').slice(0, 255) || null : null;

/**
 * Un campo `blocks` como texto llano para la fórmula: párrafos y viñetas.
 * La fórmula guarda texto y no bloques porque es una copia para imprimir, no
 * un documento que se vaya a seguir editando.
 */
function textoDeBloques(bloques: any): string | null {
  if (!Array.isArray(bloques)) return null;
  const hoja = (n: any): string => (n?.type === 'text' ? n.text ?? '' : (n?.children ?? []).map(hoja).join(''));
  const lineas: string[] = [];
  for (const b of bloques) {
    if (b?.type === 'list') {
      for (const item of b.children ?? []) lineas.push(`- ${hoja(item)}`);
    } else {
      lineas.push(hoja(b));
    }
  }
  return texto(lineas.join('\n'));
}

/** Los medicamentos de todos los planes de tratamiento de la consulta. */
function medicamentosDe(consulta: any): Array<{ plan: any; m: any }> {
  return (consulta?.sections ?? [])
    .filter((s: any) => s.__component === 'clinical.treatment-plan')
    .flatMap((plan: any) => (plan.medications ?? []).map((m: any) => ({ plan, m })));
}

function aMedicamento({ m }: { m: any }) {
  const p = m.product ?? null;
  return {
    id: m.id,
    medicamento: m.drug,
    producto: p ? { documentId: p.documentId, nombre: presentacion(p) } : null,
    principiosActivos: principiosActivos(p),
    dosis: m.dose ?? null,
    via: m.route ?? null,
    cadaHoras: m.frequencyHours ?? null,
    dias: m.durationDays ?? null,
    cantidad: m.quantity != null ? Number(m.quantity) : null,
    notas: m.notes ?? null,
    controlado: detalleDe(p)?.isControlled === true,
  };
}

const aResumen = (f: any) => ({
  documentId: f.documentId,
  numero: f.number,
  estado: f.state,
  emitidaEl: f.issuedAt,
  firmante: f.vetName ?? null,
  medicamentos: (f.items ?? []).length,
  anuladaEl: f.voidedAt ?? null,
  motivoAnulacion: f.voidReason ?? null,
});

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const docs = (uid: string) => strapi.documents(uid as any);

  /** Perfil enlazado a la cuenta del panel, con su registro profesional. */
  async function firmanteDe(cuentaId: number) {
    const perfil: any = await docs(PERFIL).findFirst({
      filters: { adminUser: { id: cuentaId } } as any,
      fields: ['firstName', 'lastName', 'occupation', 'professionalLicense', 'licenseIssuer'] as any,
      populate: { signature: true } as any,
    } as any);
    const cuenta: any = await strapi.db.query('admin::user').findOne({
      where: { id: cuentaId },
      select: ['documentId', 'firstname', 'lastname'],
    });
    return {
      cuenta,
      perfil,
      nombre: nombre(perfil) ?? (`${cuenta?.firstname ?? ''} ${cuenta?.lastname ?? ''}`.trim() || null),
      tarjeta: texto(perfil?.professionalLicense),
      entidad: texto(perfil?.licenseIssuer),
      firma: perfil?.signature ?? null,
    };
  }

  /** Por qué esa cuenta no puede firmar fórmulas, o null si puede. */
  const faltaParaFirmar = (f: Awaited<ReturnType<typeof firmanteDe>>): string | null =>
    !f.perfil
      ? 'Tu cuenta del panel no está enlazada con un perfil: sin perfil no hay tarjeta profesional que poner en la fórmula'
      : !f.tarjeta
        ? 'Tu perfil no tiene tarjeta profesional: complétala en tu perfil (Perfil → Tarjeta profesional) para poder firmar fórmulas'
        : null;

  async function consultaConPlan(consultaId: string) {
    const consulta: any = await docs(CONSULTA).findOne({
      documentId: consultaId,
      fields: ['consultedAt', 'nextControlOn'] as any,
      populate: { pet: { fields: ['name'] }, ...POPULATE_PLAN } as any,
    } as any);
    // El filtro de archivados hace que una consulta archivada no aparezca.
    if (!consulta) throw new NotFoundError('La consulta no existe o está archivada');
    return consulta;
  }

  return {
    /** Lo que necesita el panel lateral de la consulta. */
    async deConsulta(consultaId: string, cuentaId: number) {
      const consulta = await consultaConPlan(consultaId);
      const [formulas, firmante] = await Promise.all([
        docs(FORMULA).findMany({
          filters: { consultation: { documentId: consultaId } } as any,
          populate: { items: true } as any,
          sort: ['sequence:desc'],
        } as any),
        firmanteDe(cuentaId),
      ]);

      return {
        consulta: { documentId: consulta.documentId, mascota: consulta.pet?.name ?? null },
        medicamentos: medicamentosDe(consulta).map(aMedicamento),
        formulas: (formulas as any[]).map(aResumen),
        firmante: {
          nombre: firmante.nombre,
          tarjeta: firmante.tarjeta,
          entidad: firmante.entidad,
          conFirma: Boolean(firmante.firma),
          perfil: firmante.perfil?.documentId ?? null,
        },
        falta: faltaParaFirmar(firmante),
      };
    },

    /**
     * Emite una fórmula con los medicamentos elegidos (ids de
     * `clinical.medication` dentro de los planes de la consulta).
     */
    async emitir(consultaId: string, { medicamentos }: { medicamentos: number[] }, cuentaId: number) {
      const ids = [...new Set((medicamentos ?? []).map(Number).filter(Number.isFinite))];
      if (ids.length === 0) throw new ValidationError('Elige al menos un medicamento para la fórmula');

      const consulta = await consultaConPlan(consultaId);
      if (!consulta.pet) throw new ValidationError('La consulta no tiene mascota');

      const firmante = await firmanteDe(cuentaId);
      const falta = faltaParaFirmar(firmante);
      if (falta) throw new ValidationError(falta);

      const disponibles = medicamentosDe(consulta);
      const elegidos = ids.map((id) => disponibles.find(({ m }) => m.id === id));
      if (elegidos.some((e) => !e)) {
        throw new ValidationError('Algún medicamento elegido ya no está en el plan de tratamiento: recarga la consulta');
      }

      // Indicaciones y control: los de los planes de donde salen los medicamentos.
      const planes = [...new Set(elegidos.map((e) => e!.plan))];
      const instrucciones = planes.map((p) => textoDeBloques(p.recommendations)).filter(Boolean).join('\n') || null;
      const control = planes.map((p) => p.followUpOn).filter(Boolean).sort()[0] ?? consulta.nextControlOn ?? null;

      const items = elegidos.map((e) => {
        const m = e!.m;
        return {
          drug: m.drug,
          presentation: presentacion(m.product),
          activeIngredients: principiosActivos(m.product),
          dose: m.dose ?? null,
          route: m.route ?? null,
          frequencyHours: m.frequencyHours ?? null,
          durationDays: m.durationDays ?? null,
          quantity: m.quantity ?? null,
          isControlled: detalleDe(m.product)?.isControlled === true,
          notes: m.notes ?? null,
        };
      });

      // El consecutivo se toma dentro de la transacción que crea la fórmula;
      // el índice único `ux_prescriptions_sequence` es la última defensa si
      // dos emisiones simultáneas leyeran el mismo máximo.
      const creada: any = await strapi.db.transaction(async () => {
        const ultima: any = await strapi.db.query(FORMULA as any).findOne({
          select: ['sequence'],
          where: { sequence: { $notNull: true } },
          orderBy: { sequence: 'desc' },
        });
        const secuencia = Number(ultima?.sequence ?? 0) + 1;

        return enServicioDeFormulas(() =>
          docs(FORMULA).create({
            data: {
              sequence: secuencia,
              number: numeroDeFormula(secuencia),
              state: 'issued',
              issuedAt: new Date().toISOString(),
              consultation: consulta.documentId,
              pet: consulta.pet.documentId,
              vet: firmante.cuenta.documentId,
              vetName: firmante.nombre,
              vetLicense: firmante.tarjeta,
              vetLicenseIssuer: firmante.entidad,
              ...(firmante.firma ? { vetSignature: firmante.firma.id } : {}),
              items,
              instructions: instrucciones,
              followUpOn: control,
            } as any,
          })
        );
      });

      strapi.log.info(`[fórmulas] ${creada.number} emitida (consulta ${consultaId}, cuenta ${cuentaId})`);
      return aResumen({ ...creada, items });
    },

    /** Todo lo que se imprime, ya aplanado. */
    async ficha(formulaId: string) {
      const f: any = await docs(FORMULA).findOne({
        documentId: formulaId,
        populate: {
          items: true,
          vetSignature: true,
          consultation: { fields: ['consultedAt', 'reason', 'weightKg'] },
          pet: {
            fields: ['name', 'sex', 'birthDate', 'weightKg', 'color', 'microchip'],
            populate: {
              species: { fields: ['name'] },
              breed: { fields: ['name'] },
              owner: {
                populate: {
                  profile: { populate: { contacts: { fields: ['contactType', 'value', 'isPrimary'] }, addresses: true } },
                },
              },
            },
          },
        } as any,
      } as any);
      if (!f) throw new NotFoundError('La fórmula no existe');

      const perfil = f.pet?.owner?.profile;
      const contactos = [...(perfil?.contacts ?? [])].sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary));
      const primero = (tipos: string[]) => contactos.find((c: any) => tipos.includes(c.contactType))?.value ?? null;
      const dir = (perfil?.addresses ?? []).find((a: any) => a.isPrimary) ?? perfil?.addresses?.[0];
      const archivo = (a: any) => (a && /^image\/(png|jpe?g|webp|gif)$/.test(a.mime ?? '') ? { url: a.url, mime: a.mime } : null);

      return {
        documentId: f.documentId,
        numero: f.number,
        estado: f.state,
        emitidaEl: f.issuedAt,
        anuladaEl: f.voidedAt ?? null,
        motivoAnulacion: f.voidReason ?? null,
        consulta: f.consultation
          ? { documentId: f.consultation.documentId, fecha: f.consultation.consultedAt, pesoKg: f.consultation.weightKg ?? null }
          : null,
        propietario: perfil
          ? {
              nombre: nombre(perfil),
              documento: documento(perfil),
              telefono: primero(['phone', 'phone_whatsapp']),
              direccion: dir ? [dir.addressLine, dir.city].filter(Boolean).join(', ') : null,
            }
          : null,
        mascota: f.pet
          ? {
              nombre: f.pet.name,
              especie: f.pet.species?.name ?? null,
              raza: f.pet.breed?.name ?? null,
              sexo: f.pet.sex ?? null,
              nacimiento: f.pet.birthDate ?? null,
              pesoKg: f.consultation?.weightKg ?? f.pet.weightKg ?? null,
              microchip: f.pet.microchip ?? null,
            }
          : null,
        firmante: {
          nombre: f.vetName,
          tarjeta: f.vetLicense,
          entidad: f.vetLicenseIssuer ?? null,
          firma: archivo(f.vetSignature),
        },
        medicamentos: (f.items ?? []).map((i: any) => ({
          medicamento: i.drug,
          presentacion: i.presentation ?? null,
          principiosActivos: i.activeIngredients ?? null,
          dosis: i.dose ?? null,
          via: i.route ?? null,
          cadaHoras: i.frequencyHours ?? null,
          dias: i.durationDays ?? null,
          cantidad: i.quantity != null ? Number(i.quantity) : null,
          controlado: i.isControlled === true,
          notas: i.notes ?? null,
        })),
        instrucciones: f.instructions ?? null,
        proximoControl: f.followUpOn ?? null,
      };
    },

    /**
     * Anula una fórmula emitida. La puede anular quien la firmó, o una
     * cuenta con `formula.anular` (`puedeAnularAjenas`).
     */
    async anular(formulaId: string, motivo: string, { cuentaId, puedeAnularAjenas }: { cuentaId: number; puedeAnularAjenas: boolean }) {
      const razon = texto(motivo);
      if (!razon) throw new ValidationError('Indica el motivo de la anulación');

      const f: any = await docs(FORMULA).findOne({ documentId: formulaId, populate: { vet: { fields: ['id'] } } as any } as any);
      if (!f) throw new NotFoundError('La fórmula no existe');
      if (f.state === 'voided') throw new ValidationError(`La fórmula ${f.number} ya está anulada`);
      if (f.vet?.id !== cuentaId && !puedeAnularAjenas) {
        throw new ForbiddenError(`La fórmula ${f.number} la firmó otra persona: solo ella o la administración pueden anularla`);
      }

      const anulada: any = await enServicioDeFormulas(() =>
        docs(FORMULA).update({
          documentId: formulaId,
          data: { state: 'voided', voidReason: razon.slice(0, 255), voidedAt: new Date().toISOString() } as any,
        })
      );
      strapi.log.info(`[fórmulas] ${f.number} anulada por la cuenta ${cuentaId}: ${razon}`);
      return aResumen(anulada);
    },
  };
};
