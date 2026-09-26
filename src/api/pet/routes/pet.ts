import { factories } from '@strapi/strapi';

/**
 * La ficha de una mascota nunca es útil sin su especie y su raza: sin populate
 * la respuesta trae los ids y la app tiene que resolverlos aparte.
 *
 * El dueño NO se incluye a propósito. Para el rol Cliente el saneado lo
 * descarta en silencio (no puede leer `customer`), así que pedirlo solo
 * añadiría ruido a la consulta sin devolver nada. El staff que lo necesite lo
 * pide explícitamente.
 */
const ownerOnly = { policies: ['global::is-owner'] };

const lectura = {
  ...ownerOnly,
  middlewares: [
    'api::pet.populate-history',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'name:asc',
        populate: { species: true, breed: true, photos: true },
        atajos: {
          especie: { campo: 'species', relacionPor: 'documentId' },
          nombre: { campo: 'name', operador: '$containsi' },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::pet.pet', {
  config: {
    find: lectura,
    findOne: lectura,
    update: ownerOnly,
    delete: ownerOnly,
  },
});
