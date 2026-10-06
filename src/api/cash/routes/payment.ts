import { factories } from '@strapi/strapi';

/**
 * El cliente ve sus pagos (abonos, anticipos y devoluciones) con la policy
 * `is-owner`, por cliente. Quién lo recibió y en qué turno no le llegan: el
 * saneado los quita porque no puede leer `admin::user` ni `cash-session`.
 *
 *   ?factura=<documentId>&desde=AAAA-MM-DD&hasta=AAAA-MM-DD
 */
const ownerOnly = { policies: ['global::is-owner'] };

const lectura = {
  ...ownerOnly,
  middlewares: [
    'global::date-range',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'paidAt:desc',
        populate: { invoice: { fields: ['fullNumber', 'amount'] } },
        atajos: {
          factura: { campo: 'invoice', relacionPor: 'documentId' },
          desde: { campo: 'paidAt', operador: '$gte' },
          hasta: { campo: 'paidAt', operador: '$lte' },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::cash.payment' as any, {
  config: {
    find: lectura,
    findOne: lectura,
    update: ownerOnly,
    delete: ownerOnly,
  },
});
