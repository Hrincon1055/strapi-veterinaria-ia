'use strict';

/**
 * Permiso del módulo, registrado pero NO asignado aquí (lo hace
 * `src/bootstrap/admin-roles.ts` con `addPermissions`). Ver en el plugin de
 * agenda por qué asignarlo con `assignPermissions` rompía el arranque.
 *
 * `historia.ver` es uno solo para la historia porque esa parte solo lee:
 * quien puede verla puede imprimirla (imprimir es el navegador, no el
 * servidor). La fórmula médica sí escribe: emitirla es de quien prescribe, y
 * anular la de otra persona, de la administración.
 */
const ACCIONES = [
  { uid: 'historia.ver', displayName: 'Consultar e imprimir historias clínicas' },
  { uid: 'formula.emitir', displayName: 'Emitir, reimprimir y anular sus propias fórmulas médicas' },
  { uid: 'formula.anular', displayName: 'Anular fórmulas médicas firmadas por otra persona' },
].map((a) => ({ ...a, pluginName: 'veterinaria-historia', section: 'plugins' }));

module.exports = async ({ strapi }) => {
  await strapi.service('admin::permission').actionProvider.registerMany(ACCIONES);
};
