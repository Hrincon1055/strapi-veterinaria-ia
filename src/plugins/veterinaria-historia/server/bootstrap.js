'use strict';

/**
 * Permiso del módulo, registrado pero NO asignado aquí (lo hace
 * `src/bootstrap/admin-roles.ts` con `addPermissions`). Ver en el plugin de
 * agenda por qué asignarlo con `assignPermissions` rompía el arranque.
 *
 * Es uno solo porque el módulo solo lee: quien puede ver la historia puede
 * imprimirla (imprimir es el navegador, no el servidor).
 */
const ACCIONES = [
  { uid: 'historia.ver', displayName: 'Consultar e imprimir historias clínicas' },
].map((a) => ({ ...a, pluginName: 'veterinaria-historia', section: 'plugins' }));

module.exports = async ({ strapi }) => {
  await strapi.service('admin::permission').actionProvider.registerMany(ACCIONES);
};
