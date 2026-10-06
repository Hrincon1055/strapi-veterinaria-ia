/**
 * Dominio del panel de hospitalización: rótulos y formato. Sin dependencias
 * de React ni de Strapi.
 *
 * Los valores de los enums siguen en inglés en la base (y en la API); aquí se
 * traducen solo para pintarlos. Las horas llegan ya formateadas del servidor
 * en la zona de Clínica (`horaTexto`): no se recalculan con la del navegador.
 */

export const TAMANO = { small: 'Pequeña', medium: 'Mediana', large: 'Grande', xlarge: 'Muy grande' };

export const TIPO_JAULA = {
  standard: { rotulo: 'Estándar', color: 'neutral' },
  isolation: { rotulo: 'Aislamiento', color: 'warning' },
  icu: { rotulo: 'UCI', color: 'danger' },
  oxygen: { rotulo: 'Oxígeno', color: 'secondary' },
};

export const VIA = {
  oral: 'Oral', sc: 'Subcutánea', im: 'Intramuscular', iv: 'Intravenosa',
  topical: 'Tópica', otic: 'Ótica', ophthalmic: 'Oftálmica', other: 'Otra',
};

export const TIPO_ALTA = {
  medical: 'Alta médica',
  voluntary: 'Alta voluntaria (a petición del propietario)',
  transfer: 'Remisión a otra clínica',
  deceased: 'Fallecimiento',
};

export const MUCOSAS = { normal: 'Normales', pale: 'Pálidas', congested: 'Congestivas', icteric: 'Ictéricas', cyanotic: 'Cianóticas' };
export const HIDRATACION = { normal: 'Normal', mild: 'Leve (5 %)', moderate: 'Moderada (6-8 %)', severe: 'Grave (> 8 %)' };
export const ESTADO_MENTAL = { alert: 'Alerta', depressed: 'Deprimido', obtunded: 'Obnubilado', stuporous: 'Estuporoso', comatose: 'Comatoso' };
export const APETITO = { normal: 'Normal', reduced: 'Disminuido', none: 'No come' };
export const GRAVEDAD = { low: 'Leve', moderate: 'Moderada', high: 'Grave', life_threatening: 'Riesgo vital' };

/** Estado de una toma en la rejilla: rótulo y color del Design System. */
export const ESTADO_TOMA = {
  dada: { rotulo: 'Dada', color: 'success' },
  omitida: { rotulo: 'Omitida', color: 'neutral' },
  atrasada: { rotulo: 'Atrasada', color: 'danger' },
  pendiente: { rotulo: 'Pendiente', color: 'warning' },
};

export const ESTADO_ORDEN = {
  active: { rotulo: 'Activa', color: 'success' },
  suspended: { rotulo: 'Suspendida', color: 'neutral' },
  completed: { rotulo: 'Terminada', color: 'neutral' },
};

export const UNIDAD = {
  unit: 'und', box: 'caja', bottle: 'frasco', vial: 'vial', bag: 'bolsa', tablet: 'tableta',
  dose: 'dosis', ml: 'ml', g: 'g', kg: 'kg',
};

export const HORAS = Array.from({ length: 24 }, (_, h) => h);
export const dosDigitos = (h) => String(h).padStart(2, '0');

export const numero = (n, dec = 1) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('es-CO', { maximumFractionDigits: dec }).format(Number(n));

/** "29 sept. 2026" de una fecha AAAA-MM-DD, sin desplazarla de día. */
export function fechaCorta(dia) {
  if (!dia) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${dia}T12:00:00Z`));
}

export function diaLargo(dia) {
  if (!dia) return '—';
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${dia}T12:00:00Z`));
}

export const dias = (n) => (n === 1 ? '1 día' : `${n} días`);

/** Hora actual "HH:mm" del navegador, como propuesta en los formularios. */
export const horaActual = () => {
  const d = new Date();
  return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
};

/** Mensaje legible de un error del fetch client del panel. */
export const mensajeDeError = (e, porDefecto) =>
  e?.response?.data?.error?.message ?? e?.message ?? porDefecto;
