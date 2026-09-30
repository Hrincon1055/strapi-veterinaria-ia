/**
 * Dominio: cálculo de semanas y colocación de eventos en la rejilla.
 *
 * Funciones puras, sin React, sin fetch, sin Strapi. Se pueden probar solas y
 * es donde vive la única lógica que merece la pena razonar despacio: convertir
 * horas a píxeles sin que un evento se salga de su día.
 */

export const DIAS = [
  { clave: 'monday', etiqueta: 'Lun' },
  { clave: 'tuesday', etiqueta: 'Mar' },
  { clave: 'wednesday', etiqueta: 'Mié' },
  { clave: 'thursday', etiqueta: 'Jue' },
  { clave: 'friday', etiqueta: 'Vie' },
  { clave: 'saturday', etiqueta: 'Sáb' },
  { clave: 'sunday', etiqueta: 'Dom' },
];

/**
 * Fecha y hora de pared del navegador. La agenda trabaja en hora local sin
 * zona (los huecos llegan como `07:00:00.000` y las citas como `07:00Z` con
 * esa misma hora), así que "ahora" es el reloj de la recepción, no UTC:
 * con `toISOString()` hoy saltaba a mañana a partir de las 19:00 en Colombia.
 */
export function hoy(ahora = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

/** Minutos transcurridos desde la medianoche local. */
export const minutosAhora = (ahora = new Date()) => ahora.getHours() * 60 + ahora.getMinutes();

/** Lunes de la semana que contiene esa fecha. Mismo criterio que el servidor. */
export function lunesDe(fecha) {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  const dia = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dia === 0 ? 6 : dia - 1));
  return d.toISOString().slice(0, 10);
}

export function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Las siete fechas de la semana que empieza en `lunes`. */
export const fechasDeSemana = (lunes) => DIAS.map((d, i) => ({ ...d, fecha: sumarDias(lunes, i) }));

/** "2026-10-12T07:45:00.000" -> 465 (minutos desde medianoche). */
export function minutosDe(iso) {
  const h = String(iso).slice(11, 16);
  const [hh, mm] = h.split(':');
  return Number(hh) * 60 + Number(mm);
}

export const horaDe = (iso) => String(iso).slice(11, 16);

/** "12 – 18 de octubre de 2026" */
export function rotuloSemana(lunes) {
  const a = new Date(`${lunes}T00:00:00.000Z`);
  const b = new Date(`${sumarDias(lunes, 6)}T00:00:00.000Z`);
  const mes = (d) => d.toLocaleDateString('es-CO', { month: 'long', timeZone: 'UTC' });
  const anio = b.getUTCFullYear();
  return mes(a) === mes(b)
    ? `${a.getUTCDate()} – ${b.getUTCDate()} de ${mes(b)} de ${anio}`
    : `${a.getUTCDate()} de ${mes(a)} – ${b.getUTCDate()} de ${mes(b)} de ${anio}`;
}

/**
 * Franja horaria que hay que pintar: la que realmente se usa, no 00:00-24:00.
 * Si no hay nada ese día, un horario de oficina razonable.
 */
export function rangoVisible(columnas) {
  let min = 24 * 60;
  let max = 0;

  for (const col of columnas) {
    for (const dia of col.dias ?? []) {
      for (const h of dia.huecos ?? []) {
        min = Math.min(min, minutosDe(h.startAt));
        max = Math.max(max, minutosDe(h.endAt));
      }
    }
    for (const c of col.citas ?? []) {
      min = Math.min(min, minutosDe(c.startAt));
      max = Math.max(max, minutosDe(c.endAt));
    }
  }

  if (min >= max) return { min: 7 * 60, max: 18 * 60 };
  // Un poco de aire arriba y abajo, redondeando a la hora.
  return { min: Math.floor(min / 60) * 60, max: Math.ceil(max / 60) * 60 };
}

/** Colores por estado de cita. Tomados de la paleta del Design System. */
export const COLOR_ESTADO = {
  draft: 'neutral',
  scheduled: 'primary',
  confirmed: 'primary',
  arrived: 'warning',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'danger',
};

export const ETIQUETA_ESTADO = {
  draft: 'Borrador',
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  arrived: 'Llegó',
  in_progress: 'En curso',
  completed: 'Atendida',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
};
