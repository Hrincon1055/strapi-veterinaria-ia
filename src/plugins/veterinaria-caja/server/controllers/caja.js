'use strict';

const PREFIJO = 'plugin::veterinaria-caja.caja.';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MEDIOS = ['cash', 'card', 'transfer', 'credit_balance'];

const puede = (ctx, accion) => Boolean(ctx.state?.userAbility?.can(`${PREFIJO}${accion}`));

/**
 * Las reglas lanzan ValidationError con un mensaje pensado para quien está en
 * la caja ("Se recibieron $ 20.000: no alcanzan…"): se devuelve tal cual como
 * 400. Cualquier otro error sigue su curso (500 y al log).
 */
async function responder(ctx, fn) {
  try {
    const resultado = await fn();
    if (resultado === null || resultado === undefined) return ctx.notFound('No existe');
    ctx.body = { data: resultado };
    ctx.set('Cache-Control', 'no-store');
  } catch (e) {
    if (e?.name === 'ValidationError' || e?.name === 'ApplicationError') return ctx.badRequest(e.message);
    throw e;
  }
}

module.exports = ({ strapi }) => {
  const pos = () => strapi.service('api::cash.pos');
  const cuerpo = (ctx) => ctx.request.body ?? {};

  /** documentId de la cuenta del panel que hace la petición. */
  async function cuentaId(ctx) {
    const u = ctx.state?.user;
    if (u?.documentId) return u.documentId;
    const fila = await strapi.db.query('admin::user').findOne({ where: { id: u?.id }, select: ['documentId'] });
    return fila?.documentId ?? null;
  }

  /**
   * El turno donde se escribe es siempre el abierto de la cuenta: nunca el que
   * mande la interfaz. Sin turno abierto, no hay venta.
   */
  async function turnoPropio(ctx) {
    const t = await pos().turnoDe(await cuentaId(ctx));
    if (!t) {
      ctx.badRequest('No tienes un turno de caja abierto: abre la caja primero');
      return null;
    }
    return t;
  }

  /** Solo el responsable o quien supervisa ve o cierra un turno. */
  async function turnoAccesible(ctx, id) {
    const t = await pos().resumen(id).catch(() => null);
    if (!t) {
      ctx.notFound('Ese turno no existe');
      return null;
    }
    if (!puede(ctx, 'supervisar')) {
      const propio = await pos().turnoDe(await cuentaId(ctx));
      if (propio?.documentId !== id) {
        ctx.forbidden('Ese turno es de otra persona');
        return null;
      }
    }
    return t;
  }

  return {
    /** Qué puede hacer la cuenta y su turno abierto, si lo tiene. */
    async quienSoy(ctx) {
      const id = await cuentaId(ctx);
      const u = ctx.state.user;
      ctx.body = {
        cuenta: { documentId: id, nombre: `${u?.firstname ?? ''} ${u?.lastname ?? ''}`.trim() || u?.email },
        puedeOperar: puede(ctx, 'operar'),
        puedeDevolver: puede(ctx, 'devolver'),
        puedeSupervisar: puede(ctx, 'supervisar'),
        turno: await pos().turnoDe(id),
        denominaciones: pos().denominaciones(),
      };
      ctx.set('Cache-Control', 'no-store');
    },

    cajas: async (ctx) => responder(ctx, async () => pos().cajas(await cuentaId(ctx))),

    async abrir(ctx) {
      const { caja, base, conteo, notas } = cuerpo(ctx);
      await responder(ctx, () => pos().abrir({ caja, base, conteo, notas }));
    },

    async turnos(ctx) {
      const q = ctx.query ?? {};
      if ((q.desde && !FECHA.test(q.desde)) || (q.hasta && !FECHA.test(q.hasta))) return ctx.badRequest('Las fechas van como AAAA-MM-DD');
      await responder(ctx, () => pos().turnos({ desde: q.desde, hasta: q.hasta, caja: q.caja }));
    },

    async turno(ctx) {
      const t = await turnoAccesible(ctx, ctx.params.id);
      if (t) ctx.body = { data: t };
    },

    async cerrar(ctx) {
      if (!(await turnoAccesible(ctx, ctx.params.id))) return;
      const { conteo, motivo, notas } = cuerpo(ctx);
      if (!Array.isArray(conteo)) return ctx.badRequest('Indica el conteo del efectivo por denominación');
      await responder(ctx, () => pos().cerrar(ctx.params.id, { conteo, motivo, notas }));
    },

    catalogo: (ctx) => responder(ctx, () => pos().catalogo({ categoria: ctx.query?.categoria, q: ctx.query?.q })),
    buscarClientes: (ctx) => responder(ctx, () => pos().buscarClientes(ctx.query?.q)),
    crearCliente: (ctx) => responder(ctx, () => pos().crearCliente(cuerpo(ctx))),
    cliente: (ctx) => responder(ctx, () => pos().cliente(ctx.params.id)),

    async cobrar(ctx) {
      const t = await turnoPropio(ctx);
      if (!t) return;
      const { cliente, renglones, pagos, notas, vence } = cuerpo(ctx);
      if ((pagos ?? []).some((p) => !MEDIOS.includes(p?.medio))) return ctx.badRequest(`Medio de pago no válido. Usa: ${MEDIOS.join(', ')}`);
      if (vence && !FECHA.test(vence)) return ctx.badRequest('El vencimiento va como AAAA-MM-DD');
      await responder(ctx, () => pos().cobrar({ turno: t.documentId, cliente, renglones, pagos, notas, vence }));
    },

    async abonar(ctx) {
      const t = await turnoPropio(ctx);
      if (!t) return;
      const { factura, pagos } = cuerpo(ctx);
      if (!factura) return ctx.badRequest('Indica la factura');
      await responder(ctx, () => pos().abonar({ turno: t.documentId, factura, pagos }));
    },

    async anticipo(ctx) {
      const t = await turnoPropio(ctx);
      if (!t) return;
      const { cliente, pagos } = cuerpo(ctx);
      await responder(ctx, () => pos().anticipo({ turno: t.documentId, cliente, pagos }));
    },

    async devolver(ctx) {
      const t = await turnoPropio(ctx);
      if (!t) return;
      const { factura, cliente, valor, medio, motivo } = cuerpo(ctx);
      if (!MEDIOS.includes(medio)) return ctx.badRequest(`Medio no válido. Usa: ${MEDIOS.join(', ')}`);
      await responder(ctx, () => pos().devolver({ turno: t.documentId, factura, cliente, valor, medio, motivo }));
    },

    reversar: (ctx) => responder(ctx, () => pos().reversar(ctx.params.id, cuerpo(ctx).motivo)),

    async movimiento(ctx) {
      const t = await turnoPropio(ctx);
      if (!t) return;
      const { tipo, valor, concepto, referencia, soporte } = cuerpo(ctx);
      if (!['cash_in', 'withdrawal', 'expense'].includes(tipo)) return ctx.badRequest('Tipo de movimiento no válido');
      await responder(ctx, () => pos().movimiento({ turno: t.documentId, tipo, valor, concepto, referencia, soporte }));
    },

    /** Una factura con su saldo y sus pagos (cobrar en caja, reimprimir). */
    async factura(ctx) {
      await responder(ctx, async () => {
        const pagos = await pos().pagosDeFactura(ctx.params.id);
        return pos().recibo(ctx.params.id, pagos.filter((p) => p.estado === 'posted').map((p) => p.documentId));
      });
    },

    cartera: (ctx) => responder(ctx, () => pos().cartera({ q: ctx.query?.q })),

    buscarFactura: (ctx) => responder(ctx, () => pos().buscarFactura(ctx.query?.numero)),

    async origen(ctx) {
      const { tipo, id } = ctx.params;
      if (!['consulta', 'hospitalizacion'].includes(tipo)) return ctx.badRequest('Origen no válido: consulta u hospitalizacion');
      await responder(ctx, () => pos().origen(tipo, id));
    },
  };
};
