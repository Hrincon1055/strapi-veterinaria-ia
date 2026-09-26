import { factories } from '@strapi/strapi';

/**
 * La policy global `is-owner` restringe estas rutas a los datos del cliente
 * autenticado. Solo actúa sobre usuarios con rol `client`; el staff pasa sin
 * filtro porque su alcance lo define el permiso del rol.
 *
 * Los dos middlewares hacen que la app no tenga que escribir la consulta larga:
 * `populate-sections` rellena la dynamic zone y `query-defaults` traduce
 * `?pet=…&desde=…&hasta=…` a filtros y ordena por fecha descendente.
 */
const ownerOnly = { policies: ['global::is-owner'] };

const lectura = {
  ...ownerOnly,
  middlewares: [
    // Valida el rango antes de que query-defaults lo traduzca a filtros.
    'global::date-range',
    'api::clinical.populate-sections',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'consultedAt:desc',
        atajos: {
          pet: { campo: 'pet', relacionPor: 'documentId' },
          desde: { campo: 'consultedAt', operador: '$gte' },
          hasta: { campo: 'consultedAt', operador: '$lte' },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::clinical.consultation', {
  config: {
    find: lectura,
    findOne: lectura,
    update: ownerOnly,
    delete: ownerOnly,
  },
});
