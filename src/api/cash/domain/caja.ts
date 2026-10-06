/**
 * Cuentas de la caja (sección 5.7 del documento de modelo). Funciones puras:
 * las usan las reglas (`validations/cash.ts`) y el servicio `api::cash.pos`,
 * así las dos calculan lo mismo. `domain/` no lo carga Strapi como servicio.
 */

/** Billetes y monedas en circulación en Colombia (COP). */
export const DENOMINACIONES: Array<{ denomination: number; kind: 'bill' | 'coin' }> = [
  { denomination: 100000, kind: 'bill' },
  { denomination: 50000, kind: 'bill' },
  { denomination: 20000, kind: 'bill' },
  { denomination: 10000, kind: 'bill' },
  { denomination: 5000, kind: 'bill' },
  { denomination: 2000, kind: 'bill' },
  { denomination: 1000, kind: 'coin' },
  { denomination: 500, kind: 'coin' },
  { denomination: 200, kind: 'coin' },
  { denomination: 100, kind: 'coin' },
  { denomination: 50, kind: 'coin' },
];

export type Conteo = Array<{ denomination: number; quantity: number; kind?: string }>;

/** Total de un conteo por denominación. */
export const totalDelConteo = (conteo: Conteo | null | undefined): number =>
  (conteo ?? []).reduce((s, c) => s + Number(c.denomination) * Number(c.quantity || 0), 0);

export type Pago = {
  kind: 'payment' | 'refund';
  purpose: 'invoice' | 'advance';
  method: string;
  amount: number;
  state?: string;
};

export type Movimiento = { kind: 'cash_in' | 'withdrawal' | 'expense'; amount: number };

const vivos = <T extends { state?: string }>(xs: T[]) => xs.filter((x) => (x.state ?? 'posted') === 'posted');

/**
 * Efectivo que debería haber en la caja: base + cobros en efectivo (el
 * `amount` ya es neto de cambio) − devoluciones en efectivo + ingresos −
 * retiros − gastos.
 */
export function efectivoEsperado(base: number, pagos: Pago[], movimientos: Movimiento[]): number {
  let total = Number(base || 0);
  for (const p of vivos(pagos)) {
    if (p.method !== 'cash') continue;
    total += p.kind === 'refund' ? -Number(p.amount) : Number(p.amount);
  }
  for (const m of movimientos) {
    total += m.kind === 'cash_in' ? Number(m.amount) : -Number(m.amount);
  }
  return total;
}

/** Totales del turno por medio y por tipo, para el informe de cierre (Z). */
export function totalesDelTurno(base: number, pagos: Pago[], movimientos: Movimiento[]) {
  const porMedio: Record<string, number> = { cash: 0, card: 0, transfer: 0, credit_balance: 0, other: 0 };
  const devoluciones: Record<string, number> = { cash: 0, card: 0, transfer: 0, credit_balance: 0, other: 0 };
  let cobros = 0;
  let anticipos = 0;
  let nCobros = 0;
  for (const p of vivos(pagos)) {
    if (p.kind === 'refund') {
      devoluciones[p.method] = (devoluciones[p.method] ?? 0) + Number(p.amount);
      continue;
    }
    porMedio[p.method] = (porMedio[p.method] ?? 0) + Number(p.amount);
    nCobros++;
    if (p.purpose === 'advance') anticipos += Number(p.amount);
    else cobros += Number(p.amount);
  }
  const mov = { cash_in: 0, withdrawal: 0, expense: 0 };
  for (const m of movimientos) mov[m.kind] += Number(m.amount);
  return {
    base: Number(base || 0),
    porMedio,
    devoluciones,
    cobrosDeFacturas: cobros,
    anticipos,
    numeroDePagos: nCobros,
    movimientos: mov,
    efectivoEsperado: efectivoEsperado(base, pagos, movimientos),
  };
}

/**
 * Lo pagado neto de una factura (C8): pagos − devoluciones, sin reversados.
 * El estado de pago se deriva de ahí.
 */
export function pagadoDeFactura(pagos: Pago[]): number {
  return vivos(pagos).reduce((s, p) => s + (p.kind === 'refund' ? -Number(p.amount) : Number(p.amount)), 0);
}

export const estadoDePago = (pagado: number, total: number): 'unpaid' | 'partial' | 'paid' =>
  pagado <= 0 ? 'unpaid' : pagado >= total ? 'paid' : 'partial';

/**
 * Saldo a favor de un cliente (C9): anticipos y devoluciones abonadas a su
 * saldo, menos lo usado como medio de pago y lo devuelto de anticipos.
 */
export function saldoAFavor(pagos: Pago[]): number {
  let saldo = 0;
  for (const p of vivos(pagos)) {
    const amount = Number(p.amount);
    if (p.kind === 'payment' && p.method === 'credit_balance') saldo -= amount;
    else if (p.kind === 'payment' && p.purpose === 'advance') saldo += amount;
    else if (p.kind === 'refund' && p.method === 'credit_balance') saldo += amount;
    else if (p.kind === 'refund' && p.purpose === 'advance') saldo -= amount;
  }
  return saldo;
}

/** Tramo de antigüedad de una factura en cartera, en días desde el vencimiento (o la emisión). */
export function tramoDeCartera(desde: string | Date, ahora: Date = new Date()): '0-30' | '31-60' | '61-90' | '90+' {
  const dias = Math.floor((ahora.getTime() - new Date(desde).getTime()) / 86400_000);
  if (dias <= 30) return '0-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return '90+';
}
