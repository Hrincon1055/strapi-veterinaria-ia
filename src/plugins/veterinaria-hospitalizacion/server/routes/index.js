'use strict';

/**
 * Rutas del módulo de hospitalización.
 *
 * `type: 'admin'`: las protege la sesión del panel, no la de content-api.
 * Cada una declara qué permiso exige; la interfaz oculta los botones, pero la
 * protección es esta (los endpoints se pueden llamar a mano).
 */
const exige = (...acciones) => ({
  policies: [{ name: 'plugin::veterinaria-hospitalizacion.tiene-permiso', config: { acciones } }],
});

const ver = exige('ver', 'registrar', 'prescribir');
const registrar = exige('registrar');
const prescribir = exige('prescribir');
// Buscar productos: para prescribir y para una dosis única sin orden.
const registrarOPrescribir = exige('registrar', 'prescribir');

module.exports = {
  admin: {
    type: 'admin',
    routes: [
      { method: 'GET', path: '/me', handler: 'hospitalizacion.quienSoy', config: ver },
      { method: 'GET', path: '/board', handler: 'hospitalizacion.tablero', config: ver },
      { method: 'GET', path: '/hospitalizations/:id', handler: 'hospitalizacion.hoja', config: ver },
      // Paneles laterales de la ficha de mascota y de consulta.
      { method: 'GET', path: '/pets/:id', handler: 'hospitalizacion.deMascota', config: ver },
      { method: 'GET', path: '/consultations/:id', handler: 'hospitalizacion.deConsulta', config: ver },

      // Formularios
      { method: 'GET', path: '/search/pets', handler: 'hospitalizacion.buscarMascotas', config: prescribir },
      { method: 'GET', path: '/search/cages', handler: 'hospitalizacion.jaulasLibres', config: prescribir },
      { method: 'GET', path: '/search/vets', handler: 'hospitalizacion.veterinarios', config: prescribir },
      { method: 'GET', path: '/search/products', handler: 'hospitalizacion.productos', config: registrarOPrescribir },

      // Enfermería
      { method: 'POST', path: '/hospitalizations/:id/vitals', handler: 'hospitalizacion.signos', config: registrar },
      { method: 'POST', path: '/hospitalizations/:id/administrations', handler: 'hospitalizacion.toma', config: registrar },

      // Veterinario
      { method: 'POST', path: '/hospitalizations', handler: 'hospitalizacion.ingresar', config: prescribir },
      { method: 'POST', path: '/hospitalizations/:id/orders', handler: 'hospitalizacion.prescribir', config: prescribir },
      { method: 'POST', path: '/orders/:id/suspend', handler: 'hospitalizacion.suspender', config: prescribir },
      { method: 'POST', path: '/hospitalizations/:id/transfer', handler: 'hospitalizacion.trasladar', config: prescribir },
      { method: 'POST', path: '/hospitalizations/:id/discharge', handler: 'hospitalizacion.alta', config: prescribir },
    ],
  },
};
