'use strict';

/**
 * Plugin de historia clínica: parte servidor.
 *
 * En JavaScript por la misma razón que la agenda y la facturación:
 * `config/plugins.ts` lo resuelve desde `./src/plugins/…` y Strapi cargaría un
 * .ts sin compilar.
 *
 * Solo lee. Reúne en una respuesta lo que el modelo tiene repartido —ficha de
 * la mascota, alergias, carné de vacunas y consultas con sus dos dynamic
 * zones— para que el panel lo pinte e imprima. No hay content type
 * `medical-history`: la historia ES esta consulta.
 */
module.exports = {
  bootstrap: require('./bootstrap'),
  routes: require('./routes'),
  controllers: require('./controllers'),
  services: require('./services'),
  policies: require('./policies'),
};
