import { factories } from '@strapi/strapi';

/**
 * La policy global `is-owner` restringe estas rutas a los datos del cliente
 * autenticado; el staff pasa sin filtro.
 *
 * `populate-requirements` rellena la dynamic zone de requisitos y
 * `query-defaults` traduce `?pet=…&desde=…&hasta=…` sobre la fecha de viaje.
 */
const ownerOnly = { policies: ['global::is-owner'] };

const lectura = {
  ...ownerOnly,
  middlewares: [
    'global::date-range',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'travelOn:desc',
        populate: { destinationCountry: true, pet: true },
        atajos: {
          pet: { campo: 'pet', relacionPor: 'documentId' },
          destino: { campo: 'destinationCountry', relacionPor: 'isoCode' },
          estado: { campo: 'state' },
          desde: { campo: 'travelOn', operador: '$gte' },
          hasta: { campo: 'travelOn', operador: '$lte' },
        },
      },
    },

    // Después de query-defaults: este merge añade la zona sobre el
    // populate por defecto, en lugar de impedir que se aplique.
    'api::travel.populate-requirements',
  ],
};

export default factories.createCoreRouter('api::travel.travel-case', {
  config: {
    find: lectura,
    findOne: lectura,
    update: ownerOnly,
    delete: ownerOnly,
  },
});
