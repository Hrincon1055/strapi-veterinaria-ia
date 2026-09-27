import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';

const { ValidationError } = errors;

/**
 * Calcula los huecos libres de un profesional.
 *
 * Es la razón de ser del horario: sin esto, `staff-schedule` sería una ficha
 * decorativa. Aquí se cruzan cuatro fuentes:
 *
 *   horario semanal  →  qué franjas atiende cada día de la semana
 *   excepciones      →  ausencias que quitan y turnos extra que añaden
 *   citas existentes →  lo ya ocupado (solo las que bloquean agenda)
 *   duración         →  minutos por paciente, del servicio o del horario
 *
 * El plugin de calendario no hace nada de esto: solo pinta registros que ya
 * tienen fecha de inicio y fin. Esto genera los huecos que todavía no existen.
 */

const DIAS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Estados que ocupan agenda; los mismos que valida `scheduling.ts`. */
const BLOQUEAN = ['scheduled', 'confirmed', 'arrived', 'in_progress'];

/** Tope de días por consulta: generar un año de huecos minuto a minuto no ayuda a nadie. */
const MAX_DIAS = 62;

const aMinutos = (hora: string): number => {
  const [h, m] = String(hora).split(':');
  return Number(h) * 60 + Number(m);
};

const aHora = (minutos: number): string =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

/** Recorre las fechas del rango, ambas incluidas. */
function* fechasEntre(desde: string, hasta: string) {
  const d = new Date(`${desde}T00:00:00.000Z`);
  const fin = new Date(`${hasta}T00:00:00.000Z`);
  while (d <= fin) {
    yield d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

type Tramo = { inicio: number; fin: number; room: string | null; slot: number };

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * @param staffDocumentId profesional
   * @param desde/hasta     rango de fechas (AAAA-MM-DD), ambas incluidas
   * @param duracionMin     minutos por hueco; si no se indica, el del horario
   */
  async huecos(staffDocumentId: string, desde: string, hasta: string, duracionMin?: number) {
    const dias = [...fechasEntre(desde, hasta)];
    if (dias.length === 0) throw new ValidationError('El rango de fechas está vacío');
    if (dias.length > MAX_DIAS) {
      throw new ValidationError(`El rango no puede superar ${MAX_DIAS} días; se pidieron ${dias.length}`);
    }

    // --- horarios vigentes en el rango ---
    const horarios = await strapi.documents('api::scheduling.staff-schedule').findMany({
      filters: {
        staff: { documentId: staffDocumentId },
        isActive: true,
        validFrom: { $lte: hasta },
        $or: [{ validUntil: { $null: true } }, { validUntil: { $gte: desde } }],
      } as any,
      populate: { room: true, shifts: { populate: ['room'] } } as any,
    });

    if (horarios.length === 0) return { staff: staffDocumentId, dias: [], aviso: 'Sin horario activo en ese rango' };

    // --- excepciones que tocan el rango ---
    const excepciones = await strapi.documents('api::scheduling.schedule-exception').findMany({
      filters: {
        staff: { documentId: staffDocumentId },
        fromDate: { $lte: hasta },
        toDate: { $gte: desde },
      } as any,
      populate: ['room'] as any,
    });

    // --- citas que ya ocupan agenda ---
    const citas = await strapi.documents('api::scheduling.appointment').findMany({
      filters: {
        responsible: { documentId: staffDocumentId },
        state: { $in: BLOQUEAN },
        startAt: { $lte: `${hasta}T23:59:59.999Z` },
        endAt: { $gte: `${desde}T00:00:00.000Z` },
      } as any,
    });

    const resultado: any[] = [];

    for (const fecha of dias) {
      const diaSemana = DIAS[new Date(`${fecha}T00:00:00.000Z`).getUTCDay()];

      // El horario que cubre esta fecha concreta.
      const horario = (horarios as any[]).find(
        (h) => h.validFrom <= fecha && (!h.validUntil || h.validUntil >= fecha)
      );
      if (!horario) continue;

      // 1. franjas del día según el horario semanal
      let tramos: Tramo[] = (horario.shifts ?? [])
        .filter((s: any) => s.dayOfWeek === diaSemana)
        .map((s: any) => ({
          inicio: aMinutos(s.startsAt),
          fin: aMinutos(s.endsAt),
          room: s.room?.documentId ?? horario.room?.documentId ?? null,
          slot: duracionMin ?? s.slotMinutes ?? horario.slotMinutes,
        }));

      // 2. turnos extra que añaden disponibilidad ese día
      for (const e of excepciones as any[]) {
        if (e.exceptionKind !== 'extra_shift') continue;
        if (fecha < e.fromDate || fecha > e.toDate) continue;
        tramos.push({
          inicio: e.isAllDay ? 0 : aMinutos(e.fromTime),
          fin: e.isAllDay ? 24 * 60 : aMinutos(e.toTime),
          room: e.room?.documentId ?? horario.room?.documentId ?? null,
          slot: duracionMin ?? horario.slotMinutes,
        });
      }

      if (tramos.length === 0) continue;

      // 3. ausencias que recortan el día
      const ausencias = (excepciones as any[])
        .filter((e) => e.exceptionKind === 'absence' && fecha >= e.fromDate && fecha <= e.toDate)
        .map((e) => ({
          inicio: e.isAllDay ? 0 : aMinutos(e.fromTime),
          fin: e.isAllDay ? 24 * 60 : aMinutos(e.toTime),
        }));

      // 4. lo ya reservado ese día
      const ocupado = (citas as any[])
        .filter((c) => String(c.startAt).slice(0, 10) === fecha)
        .map((c) => ({
          inicio: aMinutos(String(c.startAt).slice(11, 16)),
          fin: aMinutos(String(c.endAt).slice(11, 16)),
        }));

      const choca = (a: number, b: number, lista: { inicio: number; fin: number }[]) =>
        lista.some((x) => a < x.fin && b > x.inicio);

      const libres: any[] = [];
      let totales = 0;

      for (const t of tramos) {
        for (let m = t.inicio; m + t.slot <= t.fin; m += t.slot) {
          totales++;
          const fin = m + t.slot;
          if (choca(m, fin, ausencias)) continue;
          if (choca(m, fin, ocupado)) continue;
          libres.push({
            startAt: `${fecha}T${aHora(m)}:00.000`,
            endAt: `${fecha}T${aHora(fin)}:00.000`,
            minutos: t.slot,
            room: t.room,
          });
        }
      }

      resultado.push({
        fecha,
        diaSemana,
        totales,
        libres: libres.length,
        ocupados: totales - libres.length,
        huecos: libres,
      });
    }

    return { staff: staffDocumentId, desde, hasta, dias: resultado };
  },
});
