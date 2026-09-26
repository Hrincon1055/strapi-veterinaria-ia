import { factories } from '@strapi/strapi';

/**
 * Clientes. Es una ruta de staff: ningún cliente lista clientes, así que no
 * lleva policy de propiedad — el permiso del rol ya lo acota.
 *
 * Sin `populate` del perfil la lista sale con `searchLabel` y poco más; con
 * él, recepción ve nombre, documento y contactos para atender el teléfono.
 */
const lectura = {
  middlewares: [
    {
      name: 'global::query-defaults',
      config: {
        sort: 'searchLabel:asc',
        populate: { profile: { populate: ['contacts'] }, consents: true },
        atajos: {
          // Busca por nombre o por cédula: `searchLabel` concatena ambos.
          buscar: { campo: 'searchLabel', operador: '$containsi' },
          origen: { campo: 'referralSource' },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::customer.customer', {
  config: { find: lectura, findOne: lectura },
});
