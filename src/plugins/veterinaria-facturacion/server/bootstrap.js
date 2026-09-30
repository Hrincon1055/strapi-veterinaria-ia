'use strict';

/**
 * Permisos del módulo, registrados pero NO asignados aquí (lo hace
 * `src/bootstrap/admin-roles.ts` con `addPermissions`). Ver en el plugin de
 * agenda por qué asignarlos con `assignPermissions` rompía el arranque.
 *
 * Son cinco porque el negocio los reparte distinto: el veterinario consulta
 * qué se cobró de sus consultas; recepción prepara, emite y cobra; anular una
 * factura emitida y cambiar un precio de catálogo son de la administración.
 */
const ACCIONES = [
  { uid: 'facturacion.ver', displayName: 'Ver facturas y pendientes de cobro' },
  { uid: 'facturacion.preparar', displayName: 'Preparar borradores de factura' },
  { uid: 'facturacion.emitir', displayName: 'Emitir facturas y registrar pagos' },
  { uid: 'facturacion.anular', displayName: 'Anular facturas emitidas' },
  { uid: 'facturacion.cambiar-precio', displayName: 'Cambiar precios de catálogo en un borrador (con motivo)' },
].map((a) => ({ ...a, pluginName: 'veterinaria-facturacion', section: 'plugins' }));

module.exports = async ({ strapi }) => {
  await strapi.service('admin::permission').actionProvider.registerMany(ACCIONES);
};
