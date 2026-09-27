'use strict';

/**
 * Rutas de la agenda.
 *
 * `type: 'admin'` — las protege la autenticación del panel, no la de
 * content-api. Cada una exige además el permiso correspondiente, así que la
 * restricción vive en el servidor y no depende de que la interfaz oculte un
 * botón.
 *
 * La política es propia y no `admin::hasPermissions`: esa exige TODAS las
 * acciones que se le pasan (usa `.every`), así que con las dos en la lista
 * solo pasaba el Super Admin. Ver `policies/puede-ver-agenda.js`.
 *
 * Las dos últimas llevan otra política: mirar la agenda y llenarla son
 * permisos distintos. El veterinario atiende lo que tiene; quien reserva en
 * un hueco libre es recepción.
 */
const puedeVer = {
  policies: ['plugin::veterinaria-agenda.puede-ver-agenda'],
};

const puedeAgendar = {
  policies: ['plugin::veterinaria-agenda.puede-agendar'],
};

module.exports = {
  admin: {
    type: 'admin',
    routes: [
      { method: 'GET', path: '/me', handler: 'agenda.quienSoy', config: puedeVer },
      { method: 'GET', path: '/staff', handler: 'agenda.personal', config: puedeVer },
      { method: 'GET', path: '/week', handler: 'agenda.semana', config: puedeVer },
      { method: 'PUT', path: '/appointments/:documentId/state', handler: 'agenda.cambiarEstado', config: puedeVer },
      { method: 'POST', path: '/appointments/:documentId/consultation', handler: 'agenda.abrirConsulta', config: puedeVer },

      // Reservar: solo quien tenga `agenda.agendar`.
      { method: 'GET', path: '/pets', handler: 'agenda.mascotas', config: puedeAgendar },
      { method: 'POST', path: '/appointments', handler: 'agenda.reservar', config: puedeAgendar },
    ],
  },
};
