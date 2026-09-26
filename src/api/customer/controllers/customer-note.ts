import { factories } from '@strapi/strapi';

/**
 * El autor de una nota es siempre quien la escribe: se toma del usuario
 * autenticado y no del cuerpo de la petición, para que no se pueda suplantar.
 */
export default factories.createCoreController('api::customer.customer-note', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state?.user;
    if (user) {
      ctx.request.body = ctx.request.body ?? {};
      ctx.request.body.data = { ...(ctx.request.body.data ?? {}), author: user.documentId };
    }
    return super.create(ctx);
  },
}));
