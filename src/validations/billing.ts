import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  effective,
  effectiveRelation,
  isAfter,
  loadCurrent,
  on,
} from './helpers';

/** Campos que sí pueden cambiar en una factura ya emitida (los mueve el proveedor DIAN). */
const POST_ISSUE_EDITABLE = ['state', 'dianState', 'pdfUrl', 'xmlUrl'];

export default (strapi: Core.Strapi): void => {
  // ---- api::billing.subscription ------------------------------------------

  on(strapi, 'api::billing.subscription', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['customer', 'pet']);

    const startOn = effective<string>(data, current, 'startOn');
    const endOn = effective<string>(data, current, 'endOn');

    if (startOn && endOn && !isAfter(endOn, startOn)) {
      throw new ValidationError('La fecha de fin debe ser posterior a la de inicio');
    }

    // La mascota suscrita debe pertenecer al cliente que contrata.
    const customerId = effectiveRelation(data, current, 'customer');
    const petId = effectiveRelation(data, current, 'pet');

    if (customerId && petId) {
      const pet = await strapi.documents('api::pet.pet').findOne({
        documentId: petId,
        populate: ['owner'] as any,
      });
      const ownerId = (pet as any)?.owner?.documentId;
      if (ownerId && ownerId !== customerId) {
        throw new ValidationError('Esa mascota no pertenece al cliente de la suscripción');
      }
    }

    return next();
  });

  // ---- api::billing.benefit-usage -----------------------------------------

  on(strapi, 'api::billing.benefit-usage', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['subscription', 'benefit']);

    const subscriptionId = effectiveRelation(data, current, 'subscription');
    const benefitId = effectiveRelation(data, current, 'benefit');

    if (!subscriptionId || !benefitId) return next();

    const [subscription, benefit] = await Promise.all([
      strapi.documents('api::billing.subscription').findOne({
        documentId: subscriptionId,
        populate: ['plan'] as any,
      }),
      strapi.documents('api::billing.plan-benefit').findOne({
        documentId: benefitId,
        populate: ['plan'] as any,
      }),
    ]);

    if (!subscription) throw new ValidationError('La suscripción indicada no existe');
    if (!benefit) throw new ValidationError('El beneficio indicado no existe');

    if ((subscription as any).state !== 'active') {
      throw new ValidationError('Solo se pueden consumir beneficios de una suscripción activa');
    }

    const subPlan = (subscription as any).plan?.documentId;
    const benefitPlan = (benefit as any).plan?.documentId;
    if (subPlan && benefitPlan && subPlan !== benefitPlan) {
      throw new ValidationError('Ese beneficio no pertenece al plan de la suscripción');
    }

    // Cupo anual: se cuenta dentro de la vigencia de la suscripción.
    // quantityPerYear vacío significa ilimitado.
    const quota = (benefit as any).quantityPerYear;
    if (quota != null) {
      const used = await strapi.documents('api::billing.benefit-usage').count({
        filters: {
          subscription: { documentId: subscriptionId },
          benefit: { documentId: benefitId },
          usedAt: {
            $gte: (subscription as any).startOn,
            $lte: (subscription as any).endOn,
          },
          ...(ctx.params.documentId ? { documentId: { $ne: ctx.params.documentId } } : {}),
        } as any,
      });

      if (used >= quota) {
        throw new ValidationError(
          `El beneficio "${(benefit as any).name}" ya agotó sus ${quota} usos de la vigencia`
        );
      }
    }

    return next();
  });

  // ---- api::billing.invoice -----------------------------------------------

  on(strapi, 'api::billing.invoice', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['subscription', 'consultation']);

    // Una factura cubre una suscripción o una consulta, nunca ambas ni ninguna.
    const subscription = effectiveRelation(data, current, 'subscription');
    const consultation = effectiveRelation(data, current, 'consultation');
    const hasSubscription = !!subscription;
    const hasConsultation = !!consultation;

    if (hasSubscription === hasConsultation) {
      throw new ValidationError(
        'La factura debe referirse exactamente a una suscripción o a una consulta'
      );
    }

    // Una factura que salió de borrador queda congelada salvo los campos que
    // actualiza el proveedor de facturación electrónica.
    if (ctx.action === 'update' && current && current.state !== 'draft') {
      const touched = Object.keys(data).filter((k) => !POST_ISSUE_EDITABLE.includes(k));
      if (touched.length > 0) {
        throw new ValidationError(
          `Una factura en estado "${current.state}" solo admite cambios en ` +
            `${POST_ISSUE_EDITABLE.join(', ')}; se intentó cambiar: ${touched.join(', ')}`
        );
      }
    }

    return next();
  });
};
