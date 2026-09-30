'use strict';

/**
 * Solo pasa quien pueda dar por atendida una cita: el veterinario y la
 * administración, no recepción.
 *
 * Es la protección del endpoint, no la última: la misma regla está en
 * `src/validations/scheduling.ts`, porque recepción tiene CRUD de citas en el
 * Content Manager y podría cambiar el estado desde el formulario.
 */
const ACCION = 'plugin::veterinaria-agenda.agenda.finalizar';

module.exports = (ctx) => Boolean(ctx.state?.userAbility?.can(ACCION));
