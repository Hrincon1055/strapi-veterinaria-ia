/**
 * Cálculo de renglones y totales de una factura. Funciones puras: no saben de
 * Strapi, para poder probarlas solas y reutilizarlas en el PDF y en reportes.
 *
 * Montos en pesos enteros (convención del modelo). La cantidad es decimal
 * (media tableta, 2,5 ml), así que el bruto se redondea al peso. El IVA se
 * calcula por renglón sobre la base ya descontada y se redondea al peso en
 * cada renglón, no sobre el total: así la suma de los renglones impresos
 * coincide siempre con el total de la factura.
 */

export type Tratamiento = 'gravado' | 'exento' | 'excluido';

/** Tarifas de IVA vigentes. Las mismas que exige `billing.tax-profile`. */
export const TARIFAS_GRAVADO = [5, 19];

export type EntradaRenglon = {
  quantity: number | string;
  unitPrice: number;
  discountAmount?: number | null;
  taxTreatment: Tratamiento;
  taxRate?: number | null;
};

export type Renglon = {
  bruto: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
};

export function calcularRenglon(r: EntradaRenglon): Renglon {
  const bruto = Math.round(Number(r.quantity) * Number(r.unitPrice));
  const descuento = Number(r.discountAmount ?? 0);
  const lineSubtotal = bruto - descuento;
  const tasa = r.taxTreatment === 'gravado' ? Number(r.taxRate ?? 0) : 0;
  const lineTax = Math.round((lineSubtotal * tasa) / 100);
  return { bruto, lineSubtotal, lineTax, lineTotal: lineSubtotal + lineTax };
}

export type Totales = {
  /** Suma de los brutos, antes de descuentos. */
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  /** subtotal − descuentos + impuestos. */
  amount: number;
};

export type TramoIva = { tratamiento: Tratamiento; tarifa: number; base: number; impuesto: number };

/**
 * Base e impuesto agrupados por tratamiento y tarifa, que es como la factura
 * los tiene que mostrar ("IVA 19 % sobre 150.000"). Parte de los importes ya
 * guardados en cada renglón, no los recalcula: así cuadra al peso con ellos.
 */
export function resumenIva(
  renglones: Array<{ taxTreatment: Tratamiento; taxRate?: number | null; lineSubtotal: number; lineTax: number }>
): TramoIva[] {
  const tramos = new Map<string, TramoIva>();
  for (const r of renglones) {
    const tarifa = r.taxTreatment === 'gravado' ? Number(r.taxRate ?? 0) : 0;
    const clave = `${r.taxTreatment}|${tarifa}`;
    const t = tramos.get(clave) ?? { tratamiento: r.taxTreatment, tarifa, base: 0, impuesto: 0 };
    t.base += Number(r.lineSubtotal ?? 0);
    t.impuesto += Number(r.lineTax ?? 0);
    tramos.set(clave, t);
  }
  // Gravados primero, de mayor a menor tarifa; luego exento y excluido.
  const orden = { gravado: 0, exento: 1, excluido: 2 };
  return [...tramos.values()].sort((a, b) => orden[a.tratamiento] - orden[b.tratamiento] || b.tarifa - a.tarifa);
}

export function calcularTotales(renglones: Array<EntradaRenglon>): Totales {
  const t = { subtotal: 0, discountTotal: 0, taxTotal: 0, amount: 0 };
  for (const r of renglones) {
    const c = calcularRenglon(r);
    t.subtotal += c.bruto;
    t.discountTotal += Number(r.discountAmount ?? 0);
    t.taxTotal += c.lineTax;
    t.amount += c.lineTotal;
  }
  return t;
}
