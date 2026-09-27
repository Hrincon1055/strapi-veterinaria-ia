'use strict';

/**
 * Solo pasa quien pueda reservar citas.
 *
 * Es un permiso aparte de los de lectura a propósito: el veterinario ve su
 * agenda y atiende lo que hay en ella, pero quien llena los huecos es
 * recepción. Separarlo permite dar `ver-propia` sin dar `agendar`.
 *
 * Que el hueco no sea pulsable en la interfaz no es la protección: esta
 * política lo es. El endpoint se puede llamar a mano.
 */
const ACCION = 'plugin::veterinaria-agenda.agenda.agendar';

module.exports = (ctx) => Boolean(ctx.state?.userAbility?.can(ACCION));
