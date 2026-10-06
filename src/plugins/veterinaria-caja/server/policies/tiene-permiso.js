'use strict';

/**
 * Deja pasar a quien tenga ALGUNO de los permisos indicados en la ruta. No se
 * usa `admin::hasPermissions` porque exige TODAS (`.every`); mismo patrón que
 * facturación y hospitalización.
 */
const PREFIJO = 'plugin::veterinaria-caja.caja.';

module.exports = (ctx, config = {}) => {
  const ability = ctx.state?.userAbility;
  const acciones = config.acciones ?? [];
  if (!ability || acciones.length === 0) return false;
  return acciones.some((a) => ability.can(`${PREFIJO}${a}`));
};
