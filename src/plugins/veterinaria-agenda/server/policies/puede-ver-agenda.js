'use strict';

/**
 * Deja pasar a quien tenga CUALQUIERA de los dos permisos de la agenda.
 *
 * No se usa `admin::hasPermissions` porque su comprobación es un AND:
 *
 *   const isAuthorized = permissions.every(({ action, subject }) => ability.can(...))
 *   (@strapi/admin/dist/server/server/src/policies/hasPermissions.js)
 *
 * Con `actions: ['…ver-propia', '…ver-todas']` solo pasaba quien tuviera las
 * DOS, es decir el Super Admin. Un veterinario con `ver-propia` recibía 403 en
 * su propia agenda, y recepción con solo `ver-todas` también. Verificado con
 * una cuenta de rol restringido: 403 en /me, /staff y /week.
 *
 * El alcance no lo decide esta política sino el controlador, que vuelve a
 * preguntar por `ver-todas` y, si falta, fuerza la agenda propia aunque la
 * petición pida otra.
 */
const ACCIONES = [
  'plugin::veterinaria-agenda.agenda.ver-propia',
  'plugin::veterinaria-agenda.agenda.ver-todas',
];

module.exports = (ctx) => {
  const ability = ctx.state?.userAbility;
  if (!ability) return false;
  return ACCIONES.some((accion) => ability.can(accion));
};
