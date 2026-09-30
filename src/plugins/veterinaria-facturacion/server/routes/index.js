'use strict';

/**
 * Rutas del módulo de facturación.
 *
 * `type: 'admin'`: las protege la sesión del panel, no la de content-api.
 * Cada una declara qué permiso exige; la interfaz oculta los botones, pero la
 * protección es esta (los endpoints se pueden llamar a mano).
 *
 * El precio manual de un renglón (D5) no tiene ruta propia: el controlador
 * exige `cambiar-precio` y un motivo si la petición lo trae.
 */
const exige = (...acciones) => ({
  policies: [{ name: 'plugin::veterinaria-facturacion.tiene-permiso', config: { acciones } }],
});

const ver = exige('ver', 'preparar', 'emitir', 'anular', 'cambiar-precio');
const preparar = exige('preparar');
const emitir = exige('emitir');
const anular = exige('anular');

module.exports = {
  admin: {
    type: 'admin',
    routes: [
      { method: 'GET', path: '/me', handler: 'facturacion.quienSoy', config: ver },

      // Lectura
      { method: 'GET', path: '/pending', handler: 'facturacion.pendientes', config: ver },
      { method: 'GET', path: '/consultations/:id', handler: 'facturacion.estadoConsulta', config: ver },
      { method: 'GET', path: '/invoices', handler: 'facturacion.listar', config: ver },
      { method: 'GET', path: '/invoices/:id', handler: 'facturacion.detalle', config: ver },
      { method: 'GET', path: '/invoices/:id/pdf', handler: 'facturacion.pdf', config: ver },

      // Borradores
      { method: 'GET', path: '/customers', handler: 'facturacion.buscarClientes', config: preparar },
      { method: 'GET', path: '/catalog', handler: 'facturacion.buscarCatalogo', config: preparar },
      { method: 'POST', path: '/invoices', handler: 'facturacion.crear', config: preparar },
      { method: 'PUT', path: '/invoices/:id', handler: 'facturacion.actualizarBorrador', config: preparar },
      { method: 'DELETE', path: '/invoices/:id', handler: 'facturacion.borrar', config: preparar },
      { method: 'POST', path: '/invoices/:id/items', handler: 'facturacion.agregar', config: preparar },
      { method: 'PUT', path: '/invoices/:id/items/:item', handler: 'facturacion.actualizarRenglon', config: preparar },
      { method: 'DELETE', path: '/invoices/:id/items/:item', handler: 'facturacion.quitarRenglon', config: preparar },

      // Emisión, cobro y anulación
      { method: 'POST', path: '/invoices/:id/issue', handler: 'facturacion.emitir', config: emitir },
      { method: 'PUT', path: '/invoices/:id/payment', handler: 'facturacion.pago', config: emitir },
      { method: 'POST', path: '/invoices/:id/void', handler: 'facturacion.anular', config: anular },
    ],
  },
};
