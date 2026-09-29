'use strict';

/**
 * Deja pasar a quien tenga ALGUNO de los permisos indicados en la ruta:
 *
 *   { name: 'plugin::veterinaria-facturacion.tiene-permiso', config: { acciones: ['emitir'] } }
 *
 * No se usa `admin::hasPermissions` porque exige TODAS las acciones (`.every`);
 * ver `puede-ver-agenda.js` en el plugin de agenda.
 */
const PREFIJO = 'plugin::veterinaria-facturacion.facturacion.';

module.exports = (ctx, config = {}) => {
  const ability = ctx.state?.userAbility;
  const acciones = config.acciones ?? [];
  if (!ability || acciones.length === 0) return false;
  return acciones.some((a) => ability.can(`${PREFIJO}${a}`));
};
