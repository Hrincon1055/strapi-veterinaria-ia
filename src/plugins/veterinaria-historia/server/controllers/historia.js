'use strict';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const fechaValida = (v) => v === undefined || v === null || v === '' || FECHA.test(String(v));
const vacio = (v) => (v === '' || v === undefined || v === null ? undefined : String(v));

module.exports = ({ strapi }) => {
  const svc = () => strapi.plugin('veterinaria-historia').service('historia');

  return {
    async buscar(ctx) {
      ctx.body = { data: await svc().buscar(ctx.query?.q) };
    },

    async cliente(ctx) {
      const c = await svc().cliente(ctx.params.id);
      if (!c) return ctx.notFound('No existe ese cliente');
      ctx.body = { data: c };
    },

    /** `?mascotas=id1,id2&desde=AAAA-MM-DD&hasta=AAAA-MM-DD&orden=asc|desc` */
    async historia(ctx) {
      const q = ctx.query ?? {};
      const mascotas = String(q.mascotas ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!fechaValida(q.desde) || !fechaValida(q.hasta)) return ctx.badRequest('Las fechas van como AAAA-MM-DD');
      if (q.desde && q.hasta && q.desde > q.hasta) return ctx.badRequest('"Desde" es posterior a "hasta"');
      const orden = q.orden === 'asc' ? 'asc' : 'desc';

      try {
        const datos = await svc().historia({ mascotas, desde: vacio(q.desde), hasta: vacio(q.hasta), orden });
        const u = ctx.state.user;
        ctx.body = {
          data: {
            ...datos,
            generada: { el: new Date().toISOString(), por: `${u?.firstname ?? ''} ${u?.lastname ?? ''}`.trim() || null },
          },
        };
        // Datos clínicos y personales: que ningún intermediario los guarde.
        ctx.set('Cache-Control', 'no-store');
      } catch (e) {
        if (e?.name === 'ValidationError') return ctx.badRequest(e.message);
        throw e;
      }
    },
  };
};
