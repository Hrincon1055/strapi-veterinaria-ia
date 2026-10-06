'use strict';

/**
 * Plugin de hospitalización: parte servidor.
 *
 * En JavaScript por la misma razón que los otros plugins locales:
 * `config/plugins.ts` lo resuelve desde `./src/plugins/…` y Strapi cargaría un
 * .ts sin compilar.
 *
 * No tiene lógica de negocio: comprueba permisos y delega en
 * `api::hospitalization.ward` (lo que se pinta y lo que se escribe); las
 * reglas son las de `src/validations/hospitalization.ts`, las mismas que
 * aplica el Content Manager.
 */
module.exports = {
  bootstrap: require('./bootstrap'),
  routes: require('./routes'),
  controllers: require('./controllers'),
  policies: require('./policies'),
};
