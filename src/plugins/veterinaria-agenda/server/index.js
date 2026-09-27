'use strict';

/**
 * Plugin de agenda: parte servidor.
 *
 * Escrito en JavaScript y no en TypeScript a propósito. El plugin vive en
 * `src/plugins/`, que tsc compila a `dist/`, pero `config/plugins.ts` lo
 * resuelve desde `./src/plugins/...`: si fuera .ts, Strapi cargaría el fuente
 * sin compilar. En JS no hay ambigüedad.
 *
 * Todas las rutas son `type: 'admin'`, así que las protege la autenticación
 * del panel y NO pasan por los middlewares de content-api. Por eso la lógica
 * reutiliza los servicios que ya existen (`api::scheduling.availability`) en
 * lugar de reimplementarlos.
 */

const bootstrap = require('./bootstrap');
const routes = require('./routes');
const controllers = require('./controllers');
const services = require('./services');
const policies = require('./policies');

module.exports = {
  bootstrap,
  routes,
  controllers,
  services,
  policies,
};
