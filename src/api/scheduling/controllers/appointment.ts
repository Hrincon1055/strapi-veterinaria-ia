import { factories } from '@strapi/strapi';

/**
 * `bookedBy` registra quién agendó la cita, no a quién atiende: se toma del
 * usuario autenticado en el momento de crearla.
 */
export default factories.createCoreController('api::scheduling.appointment', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state?.user;
    if (user) {
      ctx.request.body = ctx.request.body ?? {};
      ctx.request.body.data = { ...(ctx.request.body.data ?? {}), bookedBy: user.documentId };
    }
    return super.create(ctx);
  },
}));
