'use strict';

/**
 * Deja pasar a quien tenga ALGUNO de los permisos indicados en la ruta:
 *
 *   { name: 'plugin::veterinaria-hospitalizacion.tiene-permiso', config: { acciones: ['registrar'] } }
 *
 * No se usa `admin::hasPermissions` porque exige TODAS las acciones (`.every`);
 * ver `puede-ver-agenda.js` en el plugin de agenda. Mismo patrón que la
 * política de facturación.
 */
const PREFIJO = 'plugin::veterinaria-hospitalizacion.hospitalizacion.';

module.exports = (ctx, config = {}) => {
  const ability = ctx.state?.userAbility;
  const acciones = config.acciones ?? [];
  if (!ability || acciones.length === 0) return false;
  return acciones.some((a) => ability.can(`${PREFIJO}${a}`));
};
