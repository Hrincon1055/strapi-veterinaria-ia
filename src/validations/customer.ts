import type { Core } from '@strapi/strapi';
import { loadCurrent, on } from './helpers';

const CONSENT_FIELDS = ['marketing', 'sms', 'email', 'dataProcessing'] as const;

export default (strapi: Core.Strapi): void => {
  on(strapi, 'api::customer.customer', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    if (!data.consents) return next();

    const current = await loadCurrent(strapi, ctx, ['consents']);
    const before = current?.consents;

    // `lastChangedAt` refleja cuándo cambió por última vez algún consentimiento,
    // no cuándo se guardó el cliente: solo se toca si alguno cambia de valor.
    const changed =
      !before ||
      CONSENT_FIELDS.some(
        (f) => data.consents[f] !== undefined && data.consents[f] !== before[f]
      );

    if (changed) {
      data.consents = { ...data.consents, lastChangedAt: new Date().toISOString() };
      ctx.params.data = data;
    }

    return next();
  });
};
