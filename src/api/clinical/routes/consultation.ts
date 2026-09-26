import { factories } from '@strapi/strapi';

/**
 * La policy global `is-owner` restringe estas rutas a los datos del cliente
 * autenticado. Solo actúa sobre usuarios con rol `client`; el staff pasa sin
 * filtro porque su alcance lo define el permiso del rol.
 */
const ownerOnly = { policies: ['global::is-owner'] };

export default factories.createCoreRouter('api::clinical.consultation', {
  config: {
    find: ownerOnly,
    findOne: ownerOnly,
    update: ownerOnly,
    delete: ownerOnly,
  },
});
