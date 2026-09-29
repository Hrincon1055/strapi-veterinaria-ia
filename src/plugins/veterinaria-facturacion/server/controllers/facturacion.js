'use strict';

const PREFIJO = 'plugin::veterinaria-facturacion.facturacion.';
const ESTADOS_PAGO = ['unpaid', 'partial', 'paid'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const puede = (ctx, accion) => Boolean(ctx.state?.userAbility?.can(`${PREFIJO}${accion}`));

/**
 * Las reglas de negocio lanzan ValidationError con un mensaje pensado para
 * quien factura ("…ya se está cobrando en la factura FE129"): se devuelve tal
 * cual como 400. Cualquier otro error sigue su curso (500 y al log).
 */
async function responder(ctx, fn) {
  try {
    const resultado = await fn();
    if (resultado === null || resultado === undefined) return ctx.notFound('No existe');
    ctx.body = { data: resultado };
  } catch (e) {
    if (e?.name === 'ValidationError' || e?.name === 'ApplicationError') return ctx.badRequest(e.message);
    throw e;
  }
}

const fechaValida = (v) => v === undefined || v === null || v === '' || FECHA.test(String(v));

module.exports = ({ strapi }) => {
  const svc = () => strapi.plugin('veterinaria-facturacion').service('facturacion');

  return {
    /** Qué puede hacer esta cuenta: la interfaz decide qué botones pinta. */
    async quienSoy(ctx) {
      ctx.body = {
        puedeVer: ['ver', 'preparar', 'emitir', 'anular'].some((a) => puede(ctx, a)),
        puedePreparar: puede(ctx, 'preparar'),
        puedeEmitir: puede(ctx, 'emitir'),
        puedeAnular: puede(ctx, 'anular'),
      };
    },

    async pendientes(ctx) {
      const q = ctx.query ?? {};
      if (!fechaValida(q.desde) || !fechaValida(q.hasta)) return ctx.badRequest('Las fechas van como AAAA-MM-DD');
      await responder(ctx, () => svc().pendientes(q));
    },

    estadoConsulta: (ctx) => responder(ctx, () => svc().estadoConsulta(ctx.params.id)),

    async listar(ctx) {
      const q = ctx.query ?? {};
      if (!fechaValida(q.desde) || !fechaValida(q.hasta)) return ctx.badRequest('Las fechas van como AAAA-MM-DD');
      try {
        ctx.body = await svc().listar(q);
      } catch (e) {
        if (e?.name === 'ValidationError') return ctx.badRequest(e.message);
        throw e;
      }
    },

    detalle: (ctx) => responder(ctx, () => svc().detalle(ctx.params.id)),

    async pdf(ctx) {
      try {
        const { pdf, nombreArchivo } = await svc().pdf(ctx.params.id);
        const disposicion = ctx.query?.descargar ? 'attachment' : 'inline';
        ctx.set('Content-Type', 'application/pdf');
        ctx.set('Content-Disposition', `${disposicion}; filename="${nombreArchivo}"`);
        // Datos personales: que ningún intermediario lo guarde.
        ctx.set('Cache-Control', 'no-store');
        ctx.body = pdf;
      } catch (e) {
        if (e?.name === 'ValidationError') return ctx.badRequest(e.message);
        throw e;
      }
    },

    buscarClientes: (ctx) => responder(ctx, () => svc().buscarClientes(ctx.query?.q)),
    buscarCatalogo: (ctx) => responder(ctx, () => svc().buscarCatalogo(ctx.query?.q)),

    async crear(ctx) {
      const { cliente, conceptos, notas } = ctx.request.body ?? {};
      if (!cliente && !(Array.isArray(conceptos) && conceptos.length > 0)) {
        return ctx.badRequest('Elige conceptos de una consulta o, para una venta directa, el cliente');
      }
      await responder(ctx, () => svc().crear({ cliente, conceptos, notas }));
    },

    async actualizarBorrador(ctx) {
      const { notas, venceEl } = ctx.request.body ?? {};
      if (!fechaValida(venceEl)) return ctx.badRequest('El vencimiento va como AAAA-MM-DD');
      await responder(ctx, () => svc().actualizarBorrador(ctx.params.id, { notas, venceEl }));
    },

    borrar: (ctx) => responder(ctx, async () => {
      await svc().borrar(ctx.params.id);
      return { borrada: true };
    }),

    async agregar(ctx) {
      const { conceptos, directo } = ctx.request.body ?? {};
      if (!(Array.isArray(conceptos) && conceptos.length > 0) && !directo) {
        return ctx.badRequest('Indica los conceptos de consulta o el servicio/producto a añadir');
      }
      await responder(ctx, () => svc().agregar(ctx.params.id, { conceptos, directo }));
    },

    async actualizarRenglon(ctx) {
      const { id, item } = ctx.params;
      const cambios = ctx.request.body ?? {};
      // D5: el descuento lo pone quien prepara; cambiar el precio del
      // catálogo, solo quien puede emitir.
      if (cambios.precioUnitario !== undefined && !puede(ctx, 'emitir')) {
        return ctx.forbidden('Cambiar el precio de catálogo requiere el permiso de emitir facturas');
      }
      if (!(await svc().renglonDe(id, item))) return ctx.notFound('Ese renglón no es de esta factura');
      await responder(ctx, () => svc().actualizarRenglon(id, item, cambios));
    },

    async quitarRenglon(ctx) {
      const { id, item } = ctx.params;
      if (!(await svc().renglonDe(id, item))) return ctx.notFound('Ese renglón no es de esta factura');
      await responder(ctx, () => svc().quitarRenglon(id, item));
    },

    async emitir(ctx) {
      const { venceEl } = ctx.request.body ?? {};
      if (!fechaValida(venceEl)) return ctx.badRequest('El vencimiento va como AAAA-MM-DD');
      await responder(ctx, () => svc().emitir(ctx.params.id, { venceEl }));
    },

    async pago(ctx) {
      const { estado } = ctx.request.body ?? {};
      if (!ESTADOS_PAGO.includes(estado)) return ctx.badRequest(`Estado de pago no válido. Usa: ${ESTADOS_PAGO.join(', ')}`);
      await responder(ctx, () => svc().pago(ctx.params.id, estado));
    },

    async anular(ctx) {
      const { motivo } = ctx.request.body ?? {};
      if (!motivo || !String(motivo).trim()) return ctx.badRequest('Indica el motivo de la anulación');
      await responder(ctx, () => svc().anular(ctx.params.id, String(motivo).trim()));
    },
  };
};
