'use strict';

/**
 * Permisos del módulo, registrados pero NO asignados aquí (lo hace
 * `src/bootstrap/admin-roles.ts` con `addPermissions`). Ver en el plugin de
 * agenda por qué asignarlos con `assignPermissions` rompía el arranque.
 *
 * Tres porque la sala los reparte así: recepción mira quién está ingresado;
 * el auxiliar registra signos y tomas; el veterinario ingresa, prescribe,
 * traslada y da el alta.
 */
const ACCIONES = [
  { uid: 'hospitalizacion.ver', displayName: 'Ver el tablero y las hojas de hospitalización' },
  { uid: 'hospitalizacion.registrar', displayName: 'Registrar signos y tomas de medicación' },
  { uid: 'hospitalizacion.prescribir', displayName: 'Ingresar, prescribir, trasladar y dar el alta' },
].map((a) => ({ ...a, pluginName: 'veterinaria-hospitalizacion', section: 'plugins' }));

module.exports = async ({ strapi }) => {
  await strapi.service('admin::permission').actionProvider.registerMany(ACCIONES);
};
