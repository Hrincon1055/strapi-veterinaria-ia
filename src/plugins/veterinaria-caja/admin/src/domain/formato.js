/**
 * Dominio del punto de venta: formato, rótulos y las cuentas del ticket. Sin
 * React ni Strapi.
 *
 * Los totales del ticket son una estimación con los precios del catálogo de
 * hoy (con IVA): el valor que vale es el de la factura que devuelve el
 * servidor al cobrar.
 */

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const dinero = (v) => pesos.format(Math.round(Number(v ?? 0)));

export const cantidad = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const hora = (v) => (v ? new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(v)) : '—');
export const fechaHora = (v) => (v ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—');
export const fecha = (v) => {
  if (!v) return '—';
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(String(v));
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', ...(soloFecha ? { timeZone: 'UTC' } : {}) })
    .format(soloFecha ? new Date(`${v}T12:00:00Z`) : new Date(v));
};

export const MEDIO = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', credit_balance: 'Saldo a favor', other: 'Otro',
};
export const CANAL = { nequi: 'Nequi', daviplata: 'Daviplata', bank: 'Banco', other: 'Otro' };
export const TIPO_MOVIMIENTO = { cash_in: 'Ingreso de efectivo', withdrawal: 'Retiro (sangría)', expense: 'Gasto menor' };
export const TRAMOS = ['0-30', '31-60', '61-90', '90+'];
export const UNIDAD = {
  unit: 'und', box: 'caja', bottle: 'frasco', vial: 'vial', bag: 'bolsa', tablet: 'tableta',
  dose: 'dosis', ml: 'ml', g: 'g', kg: 'kg', servicio: 'servicio',
};

/** Billetes para cobrar rápido en efectivo: el exacto y los billetes que lo cubren. */
export function billetesRapidos(total) {
  const t = Math.max(0, Math.round(total));
  const opciones = new Set([t]);
  for (const b of [10000, 20000, 50000, 100000]) {
    if (b >= t) opciones.add(b);
    opciones.add(Math.ceil(t / b) * b);
  }
  return [...opciones].filter((x) => x >= t && x > 0).sort((a, b) => a - b).slice(0, 5);
}

/**
 * Una línea del ticket:
 *   { clave, tipo: 'catalogo', relacion, documentId, nombre, unidad, precio (sin IVA), iva, cantidad, descuentoPct }
 *   { clave, tipo: 'concepto', consulta | hospitalizacion, lineKey, nombre, precio (sin IVA), total (con IVA), cantidad, descuentoPct }
 */
export function importeDeLinea(l) {
  const bruto = Number(l.precio ?? 0) * Number(l.cantidad ?? 0);
  const descuento = Math.round((bruto * Number(l.descuentoPct ?? 0)) / 100);
  if (l.tipo === 'concepto') {
    // El concepto trae su total estimado con IVA; el descuento lo rebaja en proporción.
    const total = Number(l.total ?? 0) * (1 - Number(l.descuentoPct ?? 0) / 100);
    return { bruto, descuento, base: bruto - descuento, impuesto: Math.max(0, Math.round(total - (bruto - descuento))), total: Math.round(total) };
  }
  const base = bruto - descuento;
  const impuesto = Math.round((base * Number(l.iva ?? 0)) / 100);
  return { bruto, descuento, base, impuesto, total: base + impuesto };
}

export function totalesDelTicket(lineas) {
  return lineas.reduce(
    (t, l) => {
      const i = importeDeLinea(l);
      return { subtotal: t.subtotal + i.base, descuentos: t.descuentos + i.descuento, impuesto: t.impuesto + i.impuesto, total: t.total + i.total };
    },
    { subtotal: 0, descuentos: 0, impuesto: 0, total: 0 }
  );
}

/** Lo que el servidor espera por cada línea: el descuento va en pesos, sobre el valor sin IVA. */
export function aRenglon(l) {
  const { descuento } = importeDeLinea(l);
  if (l.tipo === 'concepto') {
    return { tipo: 'concepto', ...(l.consulta ? { consulta: l.consulta } : { hospitalizacion: l.hospitalizacion }), lineKey: l.lineKey, descuento };
  }
  return { tipo: 'catalogo', relacion: l.relacion, documentId: l.documentId, cantidad: Number(l.cantidad), descuento };
}

/** Mensaje legible de un error del fetch client del panel. */
export const mensajeDeError = (e, porDefecto) =>
  e?.response?.data?.error?.message ?? e?.message ?? porDefecto;
