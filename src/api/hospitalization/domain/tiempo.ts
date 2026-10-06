/**
 * Fechas de la hospitalización en la zona horaria de la clínica.
 *
 * A diferencia de las citas (hora de pared con `Z`, ver `bootstrap/cierre-citas.ts`),
 * todo lo de la hospitalización se guarda como instante real en UTC (5.6, H9):
 * casi todo es "ahora" y el Content Manager lo muestra en la hora local del
 * navegador. Lo que depende del calendario —qué día de estancia es, a qué hora
 * de la hoja cae una toma— se calcula aquí, en la zona de Clínica.
 *
 * Funciones puras, sin Strapi: `domain/` no lo carga Strapi como servicio.
 */

export const ZONA_POR_DEFECTO = 'America/Bogota';

const partes = (zona: string, instante: Date): Record<string, number> => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);
  return Object.fromEntries(p.filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
};

/** Zona válida o la de por defecto. */
export function zonaValida(zona: string | null | undefined): string {
  if (!zona) return ZONA_POR_DEFECTO;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zona });
    return zona;
  } catch {
    return ZONA_POR_DEFECTO;
  }
}

/** Día (AAAA-MM-DD) de un instante en la zona. */
export function diaEnZona(instante: string | Date, zona: string): string {
  const p = partes(zona, new Date(instante));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Hora (0–23) de un instante en la zona. */
export function horaEnZona(instante: string | Date, zona: string): number {
  return partes(zona, new Date(instante)).hour;
}

/** Minutos que la zona va por delante de UTC en ese instante (Bogotá: −300). */
function desfase(zona: string, instante: Date): number {
  const p = partes(zona, instante);
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((comoUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60000);
}

/** Instante en que empieza el día (00:00 de la zona). */
export function inicioDelDia(dia: string, zona: string): Date {
  const [y, m, d] = dia.split('-').map(Number);
  const aproximado = new Date(Date.UTC(y, m - 1, d, 12));
  return new Date(Date.UTC(y, m - 1, d) - desfase(zona, aproximado) * 60000);
}

/** El día siguiente, como AAAA-MM-DD (aritmética de calendario, sin zona). */
export function diaSiguiente(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export const esDia = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Milisegundos de un instante, o null si no lo es. */
export const ms = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const t = new Date(v as any).getTime();
  return Number.isNaN(t) ? null : t;
};
