import { factories } from '@strapi/strapi';

/**
 * Lo que el cliente ve de las hospitalizaciones de sus mascotas: estado y
 * alta. La policy `is-owner` acota a las suyas; el controlador recorta los
 * campos (lista blanca) para el rol `client`.
 *
 *   ?pet=<documentId>&desde=AAAA-MM-DD&hasta=AAAA-MM-DD&estado=active
 */
const ownerOnly = { policies: ['global::is-owner'] };

const lectura = {
  ...ownerOnly,
  middlewares: [
    'global::date-range',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'admittedAt:desc',
        populate: {
          pet: { populate: { owner: { populate: ['profile'] } } },
          cage: true,
          responsibleVet: { fields: ['firstname', 'lastname'] },
        },
        atajos: {
          pet: { campo: 'pet', relacionPor: 'documentId' },
          estado: { campo: 'state' },
          desde: { campo: 'admittedAt', operador: '$gte' },
          hasta: { campo: 'admittedAt', operador: '$lte' },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::hospitalization.hospitalization' as any, {
  config: {
    find: lectura,
    findOne: lectura,
    update: ownerOnly,
    delete: ownerOnly,
  },
});
