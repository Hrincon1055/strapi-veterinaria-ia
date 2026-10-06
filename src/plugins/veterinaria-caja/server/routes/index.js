'use strict';

/**
 * Rutas del punto de venta. `type: 'admin'`: las protege la sesión del panel.
 * Cada una declara qué permiso exige; la interfaz oculta los botones, pero la
 * protección es esta.
 */
const exige = (...acciones) => ({
  policies: [{ name: 'plugin::veterinaria-caja.tiene-permiso', config: { acciones } }],
});

const operar = exige('operar');
const ver = exige('operar', 'supervisar');
const devolver = exige('devolver');
const supervisar = exige('supervisar');

module.exports = {
  admin: {
    type: 'admin',
    routes: [
      { method: 'GET', path: '/me', handler: 'caja.quienSoy', config: ver },
      { method: 'GET', path: '/registers', handler: 'caja.cajas', config: ver },

      // Turno
      { method: 'POST', path: '/sessions', handler: 'caja.abrir', config: operar },
      { method: 'GET', path: '/sessions', handler: 'caja.turnos', config: supervisar },
      { method: 'GET', path: '/sessions/:id', handler: 'caja.turno', config: ver },
      { method: 'POST', path: '/sessions/:id/close', handler: 'caja.cerrar', config: ver },

      // Vender
      { method: 'GET', path: '/catalog', handler: 'caja.catalogo', config: operar },
      { method: 'GET', path: '/customers', handler: 'caja.buscarClientes', config: operar },
      { method: 'POST', path: '/customers', handler: 'caja.crearCliente', config: operar },
      { method: 'GET', path: '/customers/:id', handler: 'caja.cliente', config: ver },
      { method: 'POST', path: '/charge', handler: 'caja.cobrar', config: operar },
      { method: 'POST', path: '/payments', handler: 'caja.abonar', config: operar },
      { method: 'POST', path: '/advances', handler: 'caja.anticipo', config: operar },
      { method: 'POST', path: '/payments/:id/reverse', handler: 'caja.reversar', config: operar },
      { method: 'POST', path: '/refunds', handler: 'caja.devolver', config: devolver },
      { method: 'POST', path: '/movements', handler: 'caja.movimiento', config: operar },

      // Consultas
      { method: 'GET', path: '/invoices', handler: 'caja.buscarFactura', config: ver },
      { method: 'GET', path: '/invoices/:id', handler: 'caja.factura', config: ver },
      { method: 'GET', path: '/origins/:tipo/:id', handler: 'caja.origen', config: operar },
      { method: 'GET', path: '/receivables', handler: 'caja.cartera', config: ver },
    ],
  },
};
