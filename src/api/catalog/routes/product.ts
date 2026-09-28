import { factories } from '@strapi/strapi';

/**
 * Catálogo de productos: lectura para la app (el cliente ve lo que se le
 * recomendó en consulta) y para integraciones. El costo de referencia es
 * `private` y no sale en ninguna respuesta.
 *
 * `query-defaults` traduce `?tipo=medication` y `?categoria=<documentId>` y
 * ordena por nombre. `populate-details` va después para que su merge no
 * impida el populate por defecto.
 */
const lectura = {
  middlewares: [
    {
      name: 'global::query-defaults',
      config: {
        sort: 'name:asc',
        populate: { category: true, image: true, tax: true },
        atajos: {
          tipo: { campo: 'productType' },
          categoria: { campo: 'category', relacionPor: 'documentId' },
        },
      },
    },
    'api::catalog.populate-details',
  ],
};

export default factories.createCoreRouter('api::catalog.product', {
  config: {
    find: lectura,
    findOne: lectura,
  },
});
