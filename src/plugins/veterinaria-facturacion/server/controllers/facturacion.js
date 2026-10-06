'use strict';

const PREFIJO = 'plugin::veterinaria-facturacion.facturacion.';
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
        puedeVer: ['ver', 'preparar', 'emitir', 'anular', 'cambiar-precio'].some((a) => puede(ctx, a)),
        puedePreparar: puede(ctx, 'preparar'),
        puedeEmitir: puede(ctx, 'emitir'),
        puedeAnular: puede(ctx, 'anular'),
        puedeCambiarPrecio: puede(ctx, 'cambiar-precio'),
        // "Cobrar en caja" abre el punto de venta con la factura.
        puedeCobrar: Boolean(ctx.state?.userAbility?.can('plugin::veterinaria-caja.caja.operar')),
      };
    },

    async pendientes(ctx) {
      const q = ctx.query ?? {};
      if (!fechaValida(q.desde) || !fechaValida(q.hasta)) return ctx.badRequest('Las fechas van como AAAA-MM-DD');
      await responder(ctx, () => svc().pendientes(q));
    },

    estadoConsulta: (ctx) => responder(ctx, () => svc().estadoConsulta(ctx.params.id)),
    estadoHospitalizacion: (ctx) => responder(ctx, () => svc().estadoHospitalizacion(ctx.params.id)),

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
        return ctx.badRequest('Elige conceptos de una consulta u hospitalización o, para una venta directa, el cliente');
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
        return ctx.badRequest('Indica los conceptos (de consulta u hospitalización) o el servicio/producto a añadir');
      }
      await responder(ctx, () => svc().agregar(ctx.params.id, { conceptos, directo }));
    },

    async actualizarRenglon(ctx) {
      const { id, item } = ctx.params;
      const cambios = ctx.request.body ?? {};
      // D5: el descuento lo pone quien prepara; cambiar el precio del
      // catálogo exige su propio permiso y un motivo, que queda en el renglón.
      if (cambios.precioUnitario !== undefined) {
        if (!puede(ctx, 'cambiar-precio')) {
          return ctx.forbidden('Cambiar el precio de catálogo requiere el permiso "Cambiar precios de catálogo"');
        }
        if (!String(cambios.motivoPrecio ?? '').trim()) return ctx.badRequest('Indica el motivo del cambio de precio');
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

    async anular(ctx) {
      const { motivo } = ctx.request.body ?? {};
      if (!motivo || !String(motivo).trim()) return ctx.badRequest('Indica el motivo de la anulación');
      await responder(ctx, () => svc().anular(ctx.params.id, String(motivo).trim()));
    },
  };
};
