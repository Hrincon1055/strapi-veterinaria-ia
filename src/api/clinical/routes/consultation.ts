import { factories } from '@strapi/strapi';

/**
 * La policy global `is-owner` restringe estas rutas a los datos del cliente
 * autenticado. Solo actúa sobre usuarios con rol `client`; el staff pasa sin
 * filtro porque su alcance lo define el permiso del rol.
 *
 * `populate-sections` rellena la dynamic zone de la historia clínica para que
 * el cliente no tenga que enumerar los siete componentes en cada petición.
 */
const ownerOnly = { policies: ['global::is-owner'] };
const conSecciones = {
  ...ownerOnly,
  middlewares: ['api::clinical.populate-sections'],
};

export default factories.createCoreRouter('api::clinical.consultation', {
  config: {
    find: conSecciones,
    findOne: conSecciones,
    update: ownerOnly,
    delete: ownerOnly,
  },
});
