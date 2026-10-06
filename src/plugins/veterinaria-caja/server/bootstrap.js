'use strict';

/**
 * Permisos del módulo, registrados pero NO asignados aquí (lo hace
 * `src/bootstrap/admin-roles.ts` con `addPermissions`). Ver en el plugin de
 * agenda por qué asignarlos con `assignPermissions` rompía el arranque.
 *
 * Tres, porque la clínica los reparte así (sección 5.7): Caja y Recepción
 * operan su turno; devolver dinero y supervisar todas las cajas es de la
 * administración.
 */
const ACCIONES = [
  { uid: 'caja.operar', displayName: 'Abrir y cerrar su turno de caja, vender y cobrar' },
  { uid: 'caja.devolver', displayName: 'Registrar devoluciones de dinero' },
  { uid: 'caja.supervisar', displayName: 'Ver y cerrar los turnos de todas las cajas' },
].map((a) => ({ ...a, pluginName: 'veterinaria-caja', section: 'plugins' }));

module.exports = async ({ strapi }) => {
  await strapi.service('admin::permission').actionProvider.registerMany(ACCIONES);
};
