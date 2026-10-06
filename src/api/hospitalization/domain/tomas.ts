import { ms } from './tiempo';

/**
 * Tomas programadas de una orden de tratamiento.
 *
 * No se guardan: salen de la orden (`startAt` + k·`frequencyHours`), así que
 * cambiar la frecuencia o suspender la orden cambia la rejilla sin migrar
 * nada. Lo que sí se guarda es cada administración, con el `scheduledFor` de
 * la toma que cubre; emparejarlas es comparar instantes.
 *
 * Una orden `isPrn` ("si es necesario") no programa tomas.
 */

export const MINUTOS_DE_GRACIA = 60;

export type Orden = {
  startAt: string;
  endAt?: string | null;
  frequencyHours?: number | null;
  isPrn?: boolean | null;
};

/**
 * Instantes (ms) de las tomas de la orden dentro de [desde, hasta), sin pasar
 * de su fin ni del alta. El fin es exclusivo: una orden de 08:00 a 20:00 cada
 * 12 h tiene una sola toma.
 */
export function programarTomas(orden: Orden, desde: number, hasta: number, finEstancia?: number | null): number[] {
  const inicio = ms(orden.startAt);
  const cada = Number(orden.frequencyHours);
  if (orden.isPrn || inicio === null || !Number.isFinite(cada) || cada <= 0) return [];

  const finOrden = ms(orden.endAt);
  const limites = [hasta, finOrden, finEstancia].filter((x): x is number => typeof x === 'number');
  const fin = Math.min(...limites);
  const paso = cada * 3600_000;

  const tomas: number[] = [];
  // Primera toma >= desde.
  let k = inicio >= desde ? 0 : Math.ceil((desde - inicio) / paso);
  for (let t = inicio + k * paso; t < fin && tomas.length < 1000; k++, t = inicio + k * paso) {
    tomas.push(t);
  }
  return tomas;
}

export type EstadoToma = 'dada' | 'omitida' | 'atrasada' | 'pendiente';

/** Estado de una toma programada, dada su administración (si la hay). */
export function estadoDeToma(instante: number, administracion: { state?: string } | null | undefined, ahora: number): EstadoToma {
  if (administracion?.state === 'given') return 'dada';
  if (administracion?.state === 'omitted') return 'omitida';
  return ahora > instante + MINUTOS_DE_GRACIA * 60_000 ? 'atrasada' : 'pendiente';
}
