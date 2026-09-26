import { factories } from '@strapi/strapi';

/**
 * La policy global `is-owner` restringe estas rutas a los datos del cliente
 * autenticado. Solo actúa sobre usuarios con rol `client`; el staff pasa sin
 * filtro porque su alcance lo define el permiso del rol.
 *
 * Recepción busca personas por nombre o por documento todo el día: el atajo
 * `?buscar=` va contra `searchLabel`, que concatena ambos.
 */
const ownerOnly = { policies: ['global::is-owner'] };

const lectura = {
  ...ownerOnly,
  middlewares: [
    {
      name: 'global::query-defaults',
      config: {
        sort: 'searchLabel:asc',
        populate: { contacts: true, addresses: true, country: true },
        atajos: {
          buscar: { campo: 'searchLabel', operador: '$containsi' },
          documento: { campo: 'documentNumber' },
          tipoDocumento: { campo: 'documentType' },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::identity.profile', {
  config: { find: lectura, findOne: lectura, update: ownerOnly, delete: ownerOnly },
});
