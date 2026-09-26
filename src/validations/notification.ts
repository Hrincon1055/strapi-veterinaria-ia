import type { Core } from '@strapi/strapi';
import { assertNoDuplicate, effective, effectiveRelation, loadCurrent, on } from './helpers';

export default (strapi: Core.Strapi): void => {
  // ---- api::notification.notification-recipient ---------------------------

  on(strapi, 'api::notification.notification-recipient', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['notification', 'recipient']);

    const notification = effectiveRelation(data, current, 'notification');
    const recipient = effectiveRelation(data, current, 'recipient');

    if (notification && recipient) {
      await assertNoDuplicate(
        strapi,
        'api::notification.notification-recipient',
        { notification: { documentId: notification }, recipient: { documentId: recipient } },
        ctx.params.documentId,
        'Ese destinatario ya está en la notificación'
      );
    }

    return next();
  });

  // ---- api::notification.notification-delivery ----------------------------

  on(strapi, 'api::notification.notification-delivery', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['recipient']);

    const recipient = effectiveRelation(data, current, 'recipient');
    const channel = effective<string>(data, current, 'channel');

    // Un envío por canal y destinatario: la cola no debe duplicar mensajes.
    if (recipient && channel) {
      await assertNoDuplicate(
        strapi,
        'api::notification.notification-delivery',
        { recipient: { documentId: recipient }, channel },
        ctx.params.documentId,
        `Ya hay un envío por ${channel} para ese destinatario`
      );
    }

    return next();
  });
};
