import type { Core } from '@strapi/strapi';

/**
 * El orden importa: cada middleware envuelve a los siguientes.
 *
 * `global::protect-calendar` va justo después de `strapi::errors` para que su
 * respuesta 401 salga con el formato de error estándar, y antes que el resto
 * para rechazar cuanto antes lo que no debe pasar. Ver el porqué en
 * src/middlewares/protect-calendar.ts.
 */
const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'global::protect-calendar',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
