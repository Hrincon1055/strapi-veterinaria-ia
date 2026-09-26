import { factories } from '@strapi/strapi';

/**
 * El carné de vacunas siempre se lee igual: el nombre de la vacuna, de la
 * dosis más reciente a la más antigua, y casi siempre de una sola mascota.
 * Eso deja de ser trabajo del cliente.
 *
 *   antes:  ?populate[vaccine]=true&sort=appliedOn:desc
 *             &filters[pet][documentId][$eq]=xxx
 *   ahora:  ?pet=xxx
 */
const ownerOnly = { policies: ['global::is-owner'] };

const lectura = {
  ...ownerOnly,
  middlewares: [
    // Valida el rango antes de que query-defaults lo traduzca a filtros.
    'global::date-range',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'appliedOn:desc',
        populate: { vaccine: true },
        atajos: {
          pet: { campo: 'pet', relacionPor: 'documentId' },
          desde: { campo: 'appliedOn', operador: '$gte' },
          hasta: { campo: 'appliedOn', operador: '$lte' },
          // Para el aviso de refuerzos: ?vencePara=2026-12-31
          vencePara: { campo: 'nextDueOn', operador: '$lte' },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::clinical.pet-vaccination', {
  config: {
    find: lectura,
    findOne: lectura,
    update: ownerOnly,
    delete: ownerOnly,
  },
});
