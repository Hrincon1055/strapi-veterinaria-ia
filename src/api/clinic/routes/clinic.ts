import { factories } from '@strapi/strapi';

/**
 * Configuración de la clínica.
 *
 * Es un single type, así que no lleva la policy de propiedad: no hay "de
 * quién es". El alcance lo define el permiso del rol — `find` para todos los
 * autenticados (la app necesita nombre, logo y horarios) y `update` solo para
 * la administración de la clínica.
 *
 * Casi todo el contenido vive en componentes, y un componente no llega si no
 * se pide: sin este populate la respuesta trae el nombre y poco más, sin
 * dirección, sin resoluciones y sin horarios.
 *
 * `technicalKey` de la resolución es `private`, así que el saneado la quita
 * de la respuesta aunque aquí se pueble.
 */
const lectura = {
  middlewares: [
    {
      name: 'global::query-defaults',
      config: {
        populate: {
          logo: true,
          fiscalAddress: { populate: ['country'] },
          fiscalResponsibilities: true,
          resolutions: true,
          openingHours: true,
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::clinic.clinic', {
  config: { find: lectura, update: {} },
});
