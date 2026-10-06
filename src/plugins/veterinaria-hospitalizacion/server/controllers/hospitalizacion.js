'use strict';

const PREFIJO = 'plugin::veterinaria-hospitalizacion.hospitalizacion.';
const FACTURACION = 'plugin::veterinaria-facturacion.facturacion.';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS_DE_ALTA = ['medical', 'voluntary', 'transfer', 'deceased'];

const puede = (ctx, accion) => Boolean(ctx.state?.userAbility?.can(`${PREFIJO}${accion}`));

/**
 * Las reglas de negocio lanzan ValidationError con un mensaje pensado para
 * quien está en la sala ("La toma de las 08:00 ya se registró…"): se devuelve
 * tal cual como 400. Cualquier otro error sigue su curso (500 y al log).
 */
async function responder(ctx, fn) {
  try {
    const resultado = await fn();
    if (resultado === null || resultado === undefined) return ctx.notFound('No existe');
    ctx.body = { data: resultado };
    // Datos clínicos y personales: que ningún intermediario los guarde.
    ctx.set('Cache-Control', 'no-store');
  } catch (e) {
    if (e?.name === 'ValidationError' || e?.name === 'ApplicationError') return ctx.badRequest(e.message);
    throw e;
  }
}

module.exports = ({ strapi }) => {
  const ward = () => strapi.service('api::hospitalization.ward');
  const cuerpo = (ctx) => ctx.request.body ?? {};

  return {
    /** Qué puede hacer esta cuenta y si la clínica hospitaliza: la interfaz decide qué pinta. */
    async quienSoy(ctx) {
      const estado = await ward().estado();
      const ability = ctx.state?.userAbility;
      ctx.body = {
        ...estado,
        puedeVer: ['ver', 'registrar', 'prescribir'].some((a) => puede(ctx, a)),
        puedeRegistrar: puede(ctx, 'registrar'),
        puedePrescribir: puede(ctx, 'prescribir'),
        // El botón "Facturar" de la hoja lleva al plugin de facturación.
        puedeFacturar: ['ver', 'preparar', 'emitir'].some((a) => Boolean(ability?.can(`${FACTURACION}${a}`))),
      };
    },

    tablero: (ctx) => responder(ctx, () => ward().tablero()),

    async hoja(ctx) {
      const dia = ctx.query?.dia;
      if (dia && !FECHA.test(String(dia))) return ctx.badRequest('El día va como AAAA-MM-DD');
      await responder(ctx, () => ward().hoja(ctx.params.id, dia ? String(dia) : undefined));
    },

    deMascota: (ctx) => responder(ctx, () => ward().deMascota(ctx.params.id)),

    async deConsulta(ctx) {
      await responder(ctx, async () => {
        const mascota = await ward().mascotaDeConsulta(ctx.params.id);
        if (!mascota) return null;
        return { mascota, ...(await ward().deMascota(mascota)) };
      });
    },

    buscarMascotas: (ctx) => responder(ctx, () => ward().buscarMascotas(ctx.query?.q)),
    jaulasLibres: (ctx) => responder(ctx, () => ward().jaulasLibres()),
    veterinarios: (ctx) => responder(ctx, () => ward().veterinarios()),
    productos: (ctx) => responder(ctx, () => ward().productos(ctx.query?.q)),

    signos: (ctx) => responder(ctx, () => ward().registrarSignos(ctx.params.id, cuerpo(ctx))),

    async toma(ctx) {
      const b = cuerpo(ctx);
      if (!b.orden && !b.producto) return ctx.badRequest('Indica la orden o, en una dosis única, el producto');
      await responder(ctx, () => ward().registrarToma(ctx.params.id, b));
    },

    // Que la clínica hospitalice (H1) lo comprueba la regla al crear.
    ingresar: (ctx) => responder(ctx, () => ward().ingresar(cuerpo(ctx))),

    async prescribir(ctx) {
      const b = cuerpo(ctx);
      if (!b.producto) return ctx.badRequest('Indica el producto');
      await responder(ctx, () => ward().prescribir(ctx.params.id, b));
    },

    suspender: (ctx) => responder(ctx, () => ward().suspenderOrden(ctx.params.id, cuerpo(ctx))),

    trasladar: (ctx) => responder(ctx, () => ward().trasladar(ctx.params.id, cuerpo(ctx))),

    async alta(ctx) {
      const b = cuerpo(ctx);
      if (!TIPOS_DE_ALTA.includes(b.tipo)) return ctx.badRequest(`Tipo de alta no válido. Usa: ${TIPOS_DE_ALTA.join(', ')}`);
      if (b.control && !FECHA.test(String(b.control))) return ctx.badRequest('El control va como AAAA-MM-DD');
      await responder(ctx, () => ward().darAlta(ctx.params.id, b));
    },
  };
};
