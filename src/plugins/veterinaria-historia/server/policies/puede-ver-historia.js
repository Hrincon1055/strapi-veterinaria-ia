'use strict';

/**
 * Deja pasar a quien tenga el permiso `historia.ver`. La interfaz oculta el
 * menú sin él, pero la protección es esta: los endpoints se pueden llamar a
 * mano y devuelven datos clínicos y personales.
 */
module.exports = (ctx) =>
  Boolean(ctx.state?.userAbility?.can('plugin::veterinaria-historia.historia.ver'));
