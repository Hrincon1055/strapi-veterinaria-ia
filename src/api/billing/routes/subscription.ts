import { factories } from '@strapi/strapi';

/**
 * Suscripciones. Lo que se consulta a diario es qué planes vencen pronto,
 * de ahí el atajo `?venceAntesDe=`.
 */
const ownerOnly = { policies: ['global::is-owner'] };

const lectura = {
  ...ownerOnly,
  middlewares: [
    'global::date-range',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'endOn:asc',
        populate: { plan: true, pet: true, customer: true },
        atajos: {
          estado: { campo: 'state' },
          pet: { campo: 'pet', relacionPor: 'documentId' },
          plan: { campo: 'plan', relacionPor: 'documentId' },
          venceAntesDe: { campo: 'endOn', operador: '$lte' },
          desde: { campo: 'startOn', operador: '$gte' },
          hasta: { campo: 'startOn', operador: '$lte' },
        },
        porRol: {
          client: { populate: { plan: true, pet: true } },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::billing.subscription', {
  config: { find: lectura, findOne: lectura, update: ownerOnly, delete: ownerOnly },
});
