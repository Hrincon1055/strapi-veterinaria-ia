'use strict';

/**
 * Plugin de caja (punto de venta): parte servidor.
 *
 * En JavaScript por la misma razón que los otros plugins locales:
 * `config/plugins.ts` lo resuelve desde `./src/plugins/…` y Strapi cargaría un
 * .ts sin compilar.
 *
 * No tiene lógica de negocio: comprueba permisos, decide el turno (el de la
 * cuenta, nunca el que mande la interfaz) y delega en `api::cash.pos`; las
 * reglas son las de `src/validations/cash.ts` y `billing.ts`.
 */
module.exports = {
  bootstrap: require('./bootstrap'),
  routes: require('./routes'),
  controllers: require('./controllers'),
  policies: require('./policies'),
};
