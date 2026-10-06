'use strict';

/**
 * Fórmula médica. Sin lógica de negocio: delega en `api::clinical.prescribing`
 * y las reglas son las de `src/validations/prescription.ts`.
 *
 * Firma siempre la cuenta de la sesión (`ctx.state.user`); lo que mande la
 * interfaz sobre quién firma no se lee.
 */
const ANULAR_AJENAS = 'plugin::veterinaria-historia.formula.anular';

const ERRORES = { ValidationError: 'badRequest', ForbiddenError: 'forbidden', NotFoundError: 'notFound' };

module.exports = ({ strapi }) => {
  const svc = () => strapi.service('api::clinical.prescribing');

  /** Traduce los errores del servicio a su código HTTP. */
  const responder = async (ctx, fn) => {
    try {
      ctx.body = { data: await fn() };
      // Datos clínicos y personales: que ningún intermediario los guarde.
      ctx.set('Cache-Control', 'no-store');
    } catch (e) {
      const metodo = ERRORES[e?.name];
      if (metodo) return ctx[metodo](e.message);
      throw e;
    }
  };

  return {
    deConsulta(ctx) {
      return responder(ctx, () => svc().deConsulta(ctx.params.id, ctx.state.user.id));
    },

    /** Cuerpo: `{ medicamentos: number[] }` (ids de `clinical.medication`). */
    emitir(ctx) {
      const { medicamentos } = ctx.request.body ?? {};
      if (!Array.isArray(medicamentos)) return ctx.badRequest('Falta la lista de medicamentos');
      return responder(ctx, () => svc().emitir(ctx.params.id, { medicamentos }, ctx.state.user.id));
    },

    ficha(ctx) {
      return responder(ctx, async () => {
        const [formula, clinica] = await Promise.all([
          svc().ficha(ctx.params.id),
          strapi.plugin('veterinaria-historia').service('historia').clinica(),
        ]);
        return { ...formula, clinica };
      });
    },

    /** Cuerpo: `{ motivo }`. */
    anular(ctx) {
      const { motivo } = ctx.request.body ?? {};
      return responder(ctx, () =>
        svc().anular(ctx.params.id, motivo, {
          cuentaId: ctx.state.user.id,
          puedeAnularAjenas: Boolean(ctx.state.userAbility?.can(ANULAR_AJENAS)),
        })
      );
    },
  };
};
