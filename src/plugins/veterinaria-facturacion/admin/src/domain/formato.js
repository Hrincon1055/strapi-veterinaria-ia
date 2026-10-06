/**
 * Dominio del panel de facturación: formato y rótulos. Sin dependencias de
 * React ni de Strapi.
 *
 * Los valores de los enums siguen en inglés en la base (y en la API); aquí se
 * traducen solo para pintarlos.
 */

const monedas = new Map();

/** "$ 258.500". Pesos enteros, como en todo el modelo. */
export function dinero(valor, moneda = 'COP') {
  if (!monedas.has(moneda)) {
    monedas.set(moneda, new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }));
  }
  return monedas.get(moneda).format(Number(valor ?? 0));
}

export const cantidad = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(Number(n ?? 0));

/** "29 sept. 2026". Una fecha sola (AAAA-MM-DD) no se desplaza de día. */
export function fecha(v) {
  if (!v) return '—';
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(String(v));
  const d = soloFecha ? new Date(`${v}T12:00:00Z`) : new Date(v);
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', ...(soloFecha ? { timeZone: 'UTC' } : {}) }).format(d);
}

export function fechaHora(v) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));
}

export const hoy = () => new Date().toISOString().slice(0, 10);

export const haceDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

/** Estado del documento: rótulo y color del Design System. */
export const ESTADO_FACTURA = {
  draft: { rotulo: 'Borrador', color: 'neutral' },
  issued: { rotulo: 'Emitida', color: 'success' },
  dian_error: { rotulo: 'Error DIAN', color: 'danger' },
  voided: { rotulo: 'Anulada', color: 'danger' },
};

export const ESTADO_PAGO = {
  unpaid: { rotulo: 'Sin pagar', color: 'warning' },
  partial: { rotulo: 'Pago parcial', color: 'secondary' },
  paid: { rotulo: 'Pagada', color: 'success' },
};

/** Estado de una línea de consulta frente al cobro. */
export const ESTADO_LINEA = {
  pendiente: { rotulo: 'Pendiente', color: 'warning' },
  facturada: { rotulo: 'Facturada', color: 'success' },
  no_facturable: { rotulo: 'No facturable', color: 'neutral' },
};

export const RESUMEN_CONSULTA = {
  sin_conceptos: { rotulo: 'Sin conceptos cobrables', color: 'neutral' },
  sin_facturar: { rotulo: 'Sin facturar', color: 'warning' },
  parcial: { rotulo: 'Facturada en parte', color: 'secondary' },
  facturada: { rotulo: 'Facturada', color: 'success' },
};

export const ESTADO_CLINICO = {
  applied: 'Aplicado', dispensed: 'Entregado', recommended: 'Recomendado',
  // Conceptos de hospitalización (5.6).
  stay: 'Estancia', given: 'Administrado',
};

/** Ruta, fecha y nombre de un origen de la bandeja (consulta u hospitalización). */
export const origenDe = (e) =>
  e.origen === 'hospitalizacion'
    ? { tipo: 'hospitalizacion', documentId: e.hospitalizacion.documentId, fecha: e.hospitalizacion.admittedAt, ruta: 'hospitalizaciones', rotulo: 'Hospitalización' }
    : { tipo: 'consulta', documentId: e.consulta.documentId, fecha: e.consulta.consultedAt, ruta: 'consultas', rotulo: 'Consulta' };

export const TIPO_RENGLON = {
  consultation_service: 'Servicio de consulta',
  consultation_product: 'Producto de consulta',
  subscription: 'Suscripción',
  direct_service: 'Servicio',
  direct_product: 'Producto',
  custom: 'Cargo libre',
  hospitalization_stay: 'Día de hospitalización',
  hospitalization_product: 'Producto de hospitalización',
};

export const MEDIO_PAGO = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', credit_balance: 'Saldo a favor', other: 'Otro (anterior a la caja)',
};

export const UNIDAD = {
  unit: 'und', box: 'caja', bottle: 'frasco', vial: 'vial', bag: 'bolsa', tablet: 'tableta',
  dose: 'dosis', ml: 'ml', g: 'g', kg: 'kg', servicio: 'servicio', periodo: 'periodo',
};

export function iva(tratamiento, tarifa) {
  if (tratamiento === 'gravado') return `${tarifa} %`;
  if (tratamiento === 'exento') return 'Exento';
  if (tratamiento === 'excluido') return 'Excluido';
  return '—';
}

/** Mensaje legible de un error del fetch client del panel. */
export const mensajeDeError = (e, porDefecto) =>
  e?.response?.data?.error?.message ?? e?.message ?? porDefecto;
