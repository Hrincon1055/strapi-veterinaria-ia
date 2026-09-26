import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  assertNoDuplicate,
  effective,
  effectiveRelation,
  loadCurrent,
  on,
} from './helpers';

const EMAIL_TYPES = ['email', 'email_work'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// E.164: prefijo internacional obligatorio, sin ceros ni separadores.
const E164_RE = /^\+[1-9][0-9]{7,14}$/;

export default (strapi: Core.Strapi): void => {
  // ---- api::shared.contact -------------------------------------------------

  on(strapi, 'api::shared.contact', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['profile']);

    const profile = effectiveRelation(data, current, 'profile');
    const contactType = effective<string>(data, current, 'contactType');
    const value = effective<string>(data, current, 'value');
    const isPrimary = effective<boolean>(data, current, 'isPrimary');

    // Formato según el tipo de contacto.
    if (value && contactType) {
      if (EMAIL_TYPES.includes(contactType)) {
        if (!EMAIL_RE.test(value)) {
          throw new ValidationError(`"${value}" no es un correo electrónico válido`);
        }
      } else if (!E164_RE.test(value)) {
        throw new ValidationError(
          `"${value}" no es un teléfono en formato E.164 (ejemplo: +573001234567)`
        );
      }
    }

    // (profile, contactType, value) único.
    if (profile && contactType && value) {
      await assertNoDuplicate(
        strapi,
        'api::shared.contact',
        { profile: { documentId: profile }, contactType, value },
        ctx.params.documentId,
        'Ese contacto ya existe para este perfil'
      );
    }

    // Como máximo un contacto principal por (profile, contactType).
    if (isPrimary === true && profile && contactType) {
      await assertNoDuplicate(
        strapi,
        'api::shared.contact',
        { profile: { documentId: profile }, contactType, isPrimary: true },
        ctx.params.documentId,
        `Ya hay un contacto principal de tipo "${contactType}" en este perfil`
      );
    }

    return next();
  });

  // ---- api::shared.verification-code --------------------------------------

  on(strapi, 'api::shared.verification-code', ['create'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const contact = effectiveRelation(data, null, 'contact');
    const purpose = data.purpose;

    if (!contact || !purpose) return next();

    // Un solo código vigente por (contact, purpose): al emitir uno nuevo se
    // invalidan los anteriores. La transacción evita dejar dos códigos activos
    // si algo falla a mitad; strapi.db.transaction se une a la transacción en
    // curso si ya hay una abierta.
    return strapi.db.transaction(async () => {
      const previous = await strapi.documents('api::shared.verification-code').findMany({
        filters: { contact: { documentId: contact }, purpose, usedAt: { $null: true } } as any,
      });

      for (const code of previous) {
        await strapi.documents('api::shared.verification-code').update({
          documentId: code.documentId,
          data: { usedAt: new Date().toISOString() } as any,
        });
      }

      return next();
    });
  });
};
