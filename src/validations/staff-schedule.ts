import type { Core } from '@strapi/strapi';
import { ValidationError, effective, effectiveRelation, isAfter, loadCurrent, on } from './helpers';

/**
 * Reglas de los horarios de atención y sus excepciones.
 *
 * Un horario mal configurado no da error: simplemente genera huecos que no
 * existen o deja de generar los que sí. Como de esto depende lo que se puede
 * reservar, se valida al guardar.
 */

const DIAS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** "08:30:00.000" -> 510 minutos desde medianoche. */
export function aMinutos(hora: string): number {
  const [h, m] = String(hora).split(':');
  return Number(h) * 60 + Number(m);
}

export default (strapi: Core.Strapi): void => {
  // ---- horarios --------------------------------------------------------

  on(strapi, 'api::scheduling.staff-schedule', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['staff', 'shifts']);

    const validFrom = effective<string>(data, current, 'validFrom');
    const validUntil = effective<string>(data, current, 'validUntil');

    if (validFrom && validUntil && !isAfter(validUntil, validFrom)) {
      throw new ValidationError('La vigencia final debe ser posterior a la inicial');
    }

    const shifts = effective<any[]>(data, current, 'shifts');
    if (Array.isArray(shifts)) {
      for (const s of shifts) {
        if (!DIAS.includes(s?.dayOfWeek)) {
          throw new ValidationError(`Día no válido en una franja: "${s?.dayOfWeek}"`);
        }
        if (!s.startsAt || !s.endsAt) {
          throw new ValidationError(`La franja del ${s.dayOfWeek} necesita hora de inicio y de fin`);
        }
        if (aMinutos(s.endsAt) <= aMinutos(s.startsAt)) {
          throw new ValidationError(
            `La franja del ${s.dayOfWeek} termina (${s.endsAt}) antes de empezar (${s.startsAt})`
          );
        }
      }

      // Dos franjas del mismo día no pueden pisarse: se duplicarían los huecos.
      for (const dia of DIAS) {
        const delDia = shifts
          .filter((s) => s.dayOfWeek === dia)
          .sort((a, b) => aMinutos(a.startsAt) - aMinutos(b.startsAt));

        for (let i = 1; i < delDia.length; i++) {
          if (aMinutos(delDia[i].startsAt) < aMinutos(delDia[i - 1].endsAt)) {
            throw new ValidationError(
              `Dos franjas del ${dia} se solapan: ${delDia[i - 1].startsAt}-${delDia[i - 1].endsAt} y ${delDia[i].startsAt}-${delDia[i].endsAt}`
            );
          }
        }
      }
    }

    // Un profesional no puede tener dos horarios activos cuyas vigencias se
    // crucen: el generador de huecos no sabría cuál aplicar.
    const staff = effectiveRelation(data, current, 'staff');
    const activo = effective<boolean>(data, current, 'isActive');

    if (staff && activo === true && validFrom) {
      const otros = await strapi.documents('api::scheduling.staff-schedule').findMany({
        filters: {
          staff: { documentId: staff },
          isActive: true,
          ...(ctx.params.documentId ? { documentId: { $ne: ctx.params.documentId } } : {}),
        } as any,
      });

      for (const o of otros as any[]) {
        const seCruzan =
          (!o.validUntil || o.validUntil >= validFrom) &&
          (!validUntil || validUntil >= o.validFrom);
        if (seCruzan) {
          throw new ValidationError(
            `Ya hay un horario activo para esa persona entre ${o.validFrom} y ${o.validUntil ?? 'sin fin'}. ` +
              'Ciérralo poniéndole fecha de fin, o desactívalo, antes de crear el nuevo.'
          );
        }
      }
    }

    return next();
  });

  // ---- excepciones -----------------------------------------------------

  on(strapi, 'api::scheduling.schedule-exception', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx);

    const fromDate = effective<string>(data, current, 'fromDate');
    const toDate = effective<string>(data, current, 'toDate');
    const isAllDay = effective<boolean>(data, current, 'isAllDay');
    const fromTime = effective<string>(data, current, 'fromTime');
    const toTime = effective<string>(data, current, 'toTime');

    if (fromDate && toDate && String(toDate) < String(fromDate)) {
      throw new ValidationError(`El rango está invertido: ${fromDate} es posterior a ${toDate}`);
    }

    if (isAllDay === false) {
      if (!fromTime || !toTime) {
        throw new ValidationError('Una excepción parcial necesita hora de inicio y de fin');
      }
      if (aMinutos(toTime) <= aMinutos(fromTime)) {
        throw new ValidationError(`La excepción termina (${toTime}) antes de empezar (${fromTime})`);
      }
    }

    return next();
  });
};
