import { factories } from '@strapi/strapi';

/**
 * Facturación. El cliente ve las suyas más recientes primero; el staff
 * necesita además de qué cliente es cada una para cobrar. Los renglones
 * (`items`) dicen qué se cobró y de qué consulta sale cada concepto.
 *
 * `?estado=issued` y `?desde=/hasta=` cubren el cierre de caja y la
 * conciliación con el proveedor de facturación electrónica.
 */
const ownerOnly = { policies: ['global::is-owner'] };

const lectura = {
  ...ownerOnly,
  middlewares: [
    'global::date-range',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'createdAt:desc',
        populate: { customer: true, subscription: true, items: true },
        atajos: {
          estado: { campo: 'state' },
          cliente: { campo: 'customer', relacionPor: 'documentId' },
          desde: { campo: 'createdAt', operador: '$gte' },
          hasta: { campo: 'createdAt', operador: '$lte' },
        },
        porRol: {
          // Poblar `customer` a un cliente es trabajo tirado: el saneado lo
          // descarta porque no puede leer ese content type.
          client: { populate: { subscription: true, items: true } },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::billing.invoice', {
  config: { find: lectura, findOne: lectura, update: ownerOnly, delete: ownerOnly },
});
