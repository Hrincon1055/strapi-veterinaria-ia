import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ValidationError } = errors;

/**
 * Resolver el público de una campaña.
 *
 * El segmento era un campo `json` que se pasaba **tal cual** como filtro de
 * Strapi: quien armaba una campaña tenía que escribir filtros a mano en el
 * panel, sin validación ni ayuda, y un error de sintaxis se descubría al
 * enviar. Ahora es la dynamic zone `segment`, y este servicio traduce cada
 * regla al filtro que le corresponde.
 *
 * Sea cual sea el segmento, solo entran clientes con consentimiento de
 * marketing y sin archivar: eso no lo puede relajar ninguna regla.
 */

/** Cada regla de la zona se traduce a un filtro sobre `api::customer.customer`. */
const TRADUCTORES: Record<string, (r: any) => any> = {
  'marketing.rule-species': (r) => {
    const id = r.species?.documentId ?? r.species;
    if (!id) throw new ValidationError('La regla "tiene mascota de especie" necesita una especie');
    return { pets: { species: { documentId: id } } };
  },

  'marketing.rule-last-visit': (r) => {
    if (!r.fecha) throw new ValidationError('La regla de última visita necesita una fecha');
    // "Sin visita desde X" es la negación: ninguna consulta posterior a X.
    return r.operador === 'con_visita_desde'
      ? { pets: { consultations: { consultedAt: { $gte: r.fecha } } } }
      : { $not: { pets: { consultations: { consultedAt: { $gte: r.fecha } } } } };
  },

  // `rule-subscription` no está aquí: `customer` no tiene relación inversa
  // `subscriptions` (solo existe `subscription.customer`, manyToOne sin
  // `inversedBy`), así que no se puede filtrar el cliente por sus
  // suscripciones. Añadir el inverso tocaría el modelo; en su lugar se
  // resuelve con una consulta aparte en `reglaSuscripcion`.

  'marketing.rule-vaccination-due': (r) => {
    if (!r.vencePara) throw new ValidationError('La regla de vacuna por vencer necesita una fecha');
    const vacuna = r.vaccine?.documentId ?? r.vaccine;
    return {
      pets: {
        vaccinations: {
          nextDueOn: { $lte: r.vencePara },
          ...(vacuna ? { vaccine: { documentId: vacuna } } : {}),
        },
      },
    };
  },

  'marketing.rule-city': (r) => {
    if (!r.city) throw new ValidationError('La regla de ciudad necesita un nombre');
    return { profile: { addresses: { city: { $containsi: r.city } } } };
  },

  'marketing.rule-referral': (r) => ({ referralSource: { $eq: r.referralSource } }),
};

/** Las siete reglas con lo que hay que poblar de cada una para traducirlas. */
const POPULATE_SEGMENTO = {
  'marketing.rule-species': { populate: ['species'] },
  'marketing.rule-last-visit': true,
  'marketing.rule-subscription': { populate: ['plan'] },
  'marketing.rule-vaccination-due': { populate: ['vaccine'] },
  'marketing.rule-city': true,
  'marketing.rule-referral': true,
};

export default factories.createCoreService('api::marketing.campaign', ({ strapi }) => ({
  /**
   * La regla de suscripción se resuelve con una consulta propia y se convierte
   * en un filtro por documentId, porque no hay camino de customer a sus
   * suscripciones en el esquema.
   */
  async reglaSuscripcion(regla: any) {
    const plan = regla.plan?.documentId ?? regla.plan;
    const buscarActivas = regla.estado === 'sin_suscripcion' ? 'active' : regla.estado;

    const suscripciones = await strapi.documents('api::billing.subscription').findMany({
      filters: {
        state: { $eq: buscarActivas },
        ...(plan ? { plan: { documentId: plan } } : {}),
      } as any,
      populate: ['customer'] as any,
    });

    const ids = [
      ...new Set(suscripciones.map((s: any) => s.customer?.documentId).filter(Boolean)),
    ];

    if (regla.estado === 'sin_suscripcion') {
      // Sin suscripción activa = todos menos esos. Con la lista vacía no se
      // filtra nada, que es justo lo correcto.
      return ids.length > 0 ? { documentId: { $notIn: ids } } : {};
    }

    // Un centinela evita que una lista vacía se interprete como "sin filtro".
    return { documentId: { $in: ids.length > 0 ? ids : ['__sin-coincidencias__'] } };
  },

  /** Traduce la zona `segment` a filtros de Strapi. Las reglas van en AND. */
  async traducirSegmento(segment: any[]): Promise<any[]> {
    const filtros: any[] = [];

    for (const regla of segment ?? []) {
      if (regla?.__component === 'marketing.rule-subscription') {
        filtros.push(await this.reglaSuscripcion(regla));
        continue;
      }

      const traductor = TRADUCTORES[regla?.__component];
      if (!traductor) {
        throw new ValidationError(`Regla de segmento desconocida: "${regla?.__component}"`);
      }
      filtros.push(traductor(regla));
    }

    return filtros;
  },

  async resolveAudience(campaignDocumentId: string) {
    const campaign = await strapi.documents('api::marketing.campaign').findOne({
      documentId: campaignDocumentId,
      populate: { segment: { on: POPULATE_SEGMENTO } } as any,
    });

    if (!campaign) return [];

    const reglas = await this.traducirSegmento((campaign as any).segment);

    // El consentimiento no es negociable desde el segmento.
    const obligatorio = { consents: { marketing: true } };

    return strapi.documents('api::customer.customer').findMany({
      filters: { $and: [obligatorio, ...reglas] } as any,
      populate: ['profile'] as any,
    });
  },
}));
