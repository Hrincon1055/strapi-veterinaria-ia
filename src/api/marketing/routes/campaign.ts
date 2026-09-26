import { factories } from '@strapi/strapi';

/**
 * Las campañas son solo de `clinic_admin`: no llevan policy de propiedad
 * porque ningún cliente las ve. El permiso del rol ya acota el acceso.
 */
const lectura = {
  middlewares: [
    {
      name: 'global::query-defaults',
      config: {
        sort: 'createdAt:desc',
        atajos: { estado: { campo: 'state' } },
      },
    },

    // Después de query-defaults: este merge añade la zona sobre el
    // populate por defecto, en lugar de impedir que se aplique.
    'api::marketing.populate-segment',
  ],
};

export default factories.createCoreRouter('api::marketing.campaign', {
  config: { find: lectura, findOne: lectura },
});
