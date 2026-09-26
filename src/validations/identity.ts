import type { Core } from '@strapi/strapi';
import { ValidationError, effective, loadCurrent, on } from './helpers';

export default (strapi: Core.Strapi): void => {
  on(strapi, 'api::identity.profile', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx);

    const documentType = effective<string>(data, current, 'documentType');
    const documentNumber = effective<string>(data, current, 'documentNumber');

    // Duplicado de documento de identidad entre perfiles no archivados.
    // El índice único parcial ux_profiles_document cubre lo mismo en la base de
    // datos; esta comprobación existe para devolver un mensaje legible antes.
    if (documentType && documentNumber) {
      const dup = await strapi.documents('api::identity.profile').findFirst({
        filters: {
          documentType,
          documentNumber,
          archivedAt: { $null: true },
          ...(ctx.params.documentId ? { documentId: { $ne: ctx.params.documentId } } : {}),
        } as any,
      });
      if (dup) {
        throw new ValidationError(
          `Ya existe un perfil con el documento ${documentType.toUpperCase()} ${documentNumber}`
        );
      }
    }

    // Componente shared.address: como máximo una dirección principal por perfil.
    const addresses = effective<any[]>(data, current, 'addresses');
    if (Array.isArray(addresses)) {
      const primary = addresses.filter((a) => a?.isPrimary === true).length;
      if (primary > 1) {
        throw new ValidationError('Solo puede haber una dirección principal por perfil');
      }
    }

    return next();
  });
};
