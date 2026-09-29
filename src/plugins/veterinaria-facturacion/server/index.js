'use strict';

/**
 * Plugin de facturación: parte servidor.
 *
 * En JavaScript por la misma razón que la agenda: `config/plugins.ts` lo
 * resuelve desde `./src/plugins/…` y Strapi cargaría un .ts sin compilar.
 *
 * No tiene lógica de negocio propia. Todas las rutas son `type: 'admin'` y
 * delegan en `api::billing.invoicing` e `api::billing.invoice-pdf`; las reglas
 * (qué es facturable, no cobrar dos veces, emitir, anular) viven en
 * `src/validations/billing.ts` y se aplican igual desde aquí, desde el Content
 * Manager o desde la API.
 */
module.exports = {
  bootstrap: require('./bootstrap'),
  routes: require('./routes'),
  controllers: require('./controllers'),
  services: require('./services'),
  policies: require('./policies'),
};
