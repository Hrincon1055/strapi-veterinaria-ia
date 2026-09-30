import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  assertNoDuplicate,
  effective,
  effectiveRelation,
  isAfter,
  loadCurrent,
  on,
  porId,
  previaDe,
  relacionDeComponente,
} from './helpers';

/** Estados que ocupan agenda: dos citas en estos estados no pueden solaparse. */
const BLOCKING_STATES = ['scheduled', 'confirmed', 'arrived', 'in_progress'];

/** Permiso del panel para pasar una cita a `completed` (plugin de agenda). */
const FINALIZAR = 'plugin::veterinaria-agenda.agenda.finalizar';

export default (strapi: Core.Strapi): void => {
  // ---- api::scheduling.service --------------------------------------------

  on(strapi, 'api::scheduling.service', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['category']);

    const category = effectiveRelation(data, current, 'category');
    const name = effective<string>(data, current, 'name');

    if (category && name) {
      await assertNoDuplicate(
        strapi,
        'api::scheduling.service',
        { category: { documentId: category }, name },
        ctx.params.documentId,
        `El servicio "${name}" ya existe en esa categoría`
      );
    }

    return next();
  });

  // ---- api::scheduling.appointment ----------------------------------------

  on(strapi, 'api::scheduling.appointment', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, {
      responsible: true,
      room: true,
      services: { populate: ['service'] },
    });

    const startAt = effective<string>(data, current, 'startAt');
    const endAt = effective<string>(data, current, 'endAt');
    const state = effective<string>(data, current, 'state');
    const previousState = current?.state;

    if (startAt && endAt && !isAfter(endAt, startAt)) {
      throw new ValidationError('La hora de fin debe ser posterior a la de inicio');
    }

    // Cancelación: exige motivo y momento.
    if (state === 'cancelled') {
      if (!effective(data, current, 'cancelledAt')) {
        data.cancelledAt = new Date().toISOString();
      }
      if (!effective(data, current, 'cancelReason')) {
        throw new ValidationError('Una cita cancelada necesita un motivo de cancelación');
      }
    }

    // Sellos de tiempo automáticos al entrar en cada estado.
    if (state === 'arrived' && previousState !== 'arrived' && !effective(data, current, 'arrivedAt')) {
      data.arrivedAt = new Date().toISOString();
    }
    if (
      state === 'completed' &&
      previousState !== 'completed' &&
      !effective(data, current, 'completedAt')
    ) {
      data.completedAt = new Date().toISOString();
    }

    // Dar por atendida una cita es de quien atiende. La regla vive aquí y no
    // solo en el plugin de agenda porque recepción tiene CRUD de citas en el
    // Content Manager y podría marcarla desde el formulario. Sin sesión
    // (el cierre nocturno de `bootstrap/cierre-citas.ts`, scripts) pasa: el
    // que llama decide. Un cliente de la app nunca.
    if (state === 'completed' && previousState !== 'completed') {
      const sesion = strapi.requestContext.get()?.state;
      const estrategia = sesion?.auth?.strategy?.name;
      if (estrategia === 'users-permissions') {
        throw new ValidationError('Una cita solo la puede dar por atendida la clínica');
      }
      if (estrategia === 'admin' && !sesion?.userAbility?.can(FINALIZAR)) {
        throw new ValidationError('Solo quien atiende puede dar la cita por atendida (permiso "Finalizar la atención")');
      }
    }

    // Líneas de servicio: completar duración y precio desde el catálogo, y
    // rechazar el mismo servicio dos veces en la misma cita.
    const services = effective<any[]>(data, current, 'services');
    if (Array.isArray(services) && 'services' in data) {
      const seen = new Set<string>();
      const guardadas = porId(current?.services);

      for (const line of services) {
        const serviceId = relacionDeComponente(line?.service, previaDe(guardadas, line), 'service');
        if (!serviceId) {
          throw new ValidationError('Cada línea de servicio debe indicar un servicio');
        }
        if (seen.has(serviceId)) {
          throw new ValidationError('Un servicio no puede repetirse en la misma cita');
        }
        seen.add(serviceId);

        if (line.durationMinutes == null || line.price == null) {
          const service = await strapi.documents('api::scheduling.service').findOne({
            documentId: serviceId,
          });
          if (service) {
            if (line.durationMinutes == null) {
              line.durationMinutes = (service as any).defaultDurationMinutes;
            }
            if (line.price == null) {
              line.price = (service as any).basePrice;
            }
          }
        }
      }

      data.services = services;
    }

    ctx.params.data = data;

    // Solapamiento de agenda por responsable y por consultorio.
    if (startAt && endAt && state && BLOCKING_STATES.includes(state)) {
      const responsible = effectiveRelation(data, current, 'responsible');
      const room = effectiveRelation(data, current, 'room');

      const targets: Array<{ field: string; id: string; label: string }> = [];
      if (responsible) targets.push({ field: 'responsible', id: responsible, label: 'responsable' });
      if (room) targets.push({ field: 'room', id: room, label: 'consultorio' });

      for (const target of targets) {
        const clash = await strapi.documents('api::scheduling.appointment').findFirst({
          filters: {
            [target.field]: { documentId: target.id },
            state: { $in: BLOCKING_STATES },
            startAt: { $lt: endAt },
            endAt: { $gt: startAt },
            ...(ctx.params.documentId ? { documentId: { $ne: ctx.params.documentId } } : {}),
          } as any,
        });
        if (clash) {
          throw new ValidationError(
            `El ${target.label} ya tiene una cita que se cruza con ese horario`
          );
        }
      }
    }

    return next();
  });

};
