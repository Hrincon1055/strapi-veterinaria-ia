'use strict';

/**
 * Rutas del módulo de historia clínica. `type: 'admin'`: las protege la
 * sesión del panel, no la de content-api. Todas exigen `historia.ver`.
 */
const ver = { policies: ['plugin::veterinaria-historia.puede-ver-historia'] };

module.exports = {
  admin: {
    type: 'admin',
    routes: [
      // Clientes por nombre, documento o nombre de una de sus mascotas.
      { method: 'GET', path: '/customers', handler: 'historia.buscar', config: ver },
      { method: 'GET', path: '/customers/:id', handler: 'historia.cliente', config: ver },
      // La historia de una o varias mascotas del mismo propietario.
      { method: 'GET', path: '/history', handler: 'historia.historia', config: ver },
    ],
  },
};
