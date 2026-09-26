import { factories } from '@strapi/strapi';

/**
 * La policy global `is-owner` restringe estas rutas a los datos del cliente
 * autenticado. Solo actúa sobre usuarios con rol `client`; el staff pasa sin
 * filtro porque su alcance lo define el permiso del rol.
 *
 * Tres middlewares: `date-range` valida el rango (y expande `?hoy=`),
 * `populate-sections` rellena la dynamic zone de la historia y
 * `query-defaults` traduce `?pet=…&desde=…&hasta=…` a filtros.
 *
 * El staff ve además qué veterinario firmó y de quién es la mascota. Al
 * cliente no se le piden: el saneado los descartaría igual porque no puede
 * leer `user` ni `customer`, así que pedirlos sería trabajo tirado.
 */
const ownerOnly = { policies: ['global::is-owner'] };

const PARA_STAFF = {
  vet: { fields: ['username', 'email'] },
  pet: { populate: { owner: { populate: ['profile'] } } },
  services: { populate: ['service'] },
};

const PARA_CLIENTE = {
  pet: true,
  services: { populate: ['service'] },
};

const lectura = {
  ...ownerOnly,
  middlewares: [
    'global::date-range',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'consultedAt:desc',
        populate: PARA_STAFF,
        atajos: {
          pet: { campo: 'pet', relacionPor: 'documentId' },
          vet: { campo: 'vet', relacionPor: 'documentId' },
          desde: { campo: 'consultedAt', operador: '$gte' },
          hasta: { campo: 'consultedAt', operador: '$lte' },
        },
        porRol: {
          client: { populate: PARA_CLIENTE },
        },
      },
    },

    // Después de query-defaults: este merge añade la zona sobre el
    // populate por defecto, en lugar de impedir que se aplique.
    'api::clinical.populate-sections',
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
