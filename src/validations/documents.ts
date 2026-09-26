import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  assertNoDuplicate,
  effective,
  effectiveRelation,
  loadCurrent,
  on,
} from './helpers';

/** Los tres posibles destinatarios de un documento; debe haber exactamente uno. */
const TARGETS = ['consultation', 'customer', 'pet'] as const;

export default (strapi: Core.Strapi): void => {
  // ---- api::documents.signed-document -------------------------------------

  on(strapi, 'api::documents.signed-document', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, [...TARGETS]);

    const bound = TARGETS.map((t) => ({ field: t, id: effectiveRelation(data, current, t) })).filter(
      (t) => !!t.id
    );

    if (bound.length !== 1) {
      throw new ValidationError(
        'El documento debe estar asociado exactamente a una consulta, un cliente o una mascota'
      );
    }

    const state = effective<string>(data, current, 'state');
    const previousState = current?.state;

    // Un documento firmado es inmutable salvo para anularlo.
    if (previousState === 'signed' && state !== 'signed' && state !== 'voided') {
      throw new ValidationError(
        'Un documento firmado solo puede pasar a anulado (voided)'
      );
    }

    if (state === 'voided') {
      if (!effective(data, current, 'voidedAt')) {
        data.voidedAt = new Date().toISOString();
      }
      if (!effective(data, current, 'voidReason')) {
        throw new ValidationError('Anular un documento exige indicar el motivo');
      }
    }

    // La versión es única por destinatario.
    const version = effective<number>(data, current, 'version');
    if (version != null) {
      const target = bound[0];
      await assertNoDuplicate(
        strapi,
        'api::documents.signed-document',
        { [target.field]: { documentId: target.id }, version },
        ctx.params.documentId,
        `Ya existe la versión ${version} de un documento para ese ${target.field}`
      );
    }

    // Componente documents.document-file: un único PDF firmado definitivo.
    const files = effective<any[]>(data, current, 'files');
    if (Array.isArray(files)) {
      const finals = files.filter((f) => f?.fileKind === 'final_signed_pdf').length;
      if (finals > 1) {
        throw new ValidationError('Solo puede haber un PDF firmado definitivo por documento');
      }
    }

    ctx.params.data = data;
    return next();
  });

  // ---- api::documents.signed-document-signer ------------------------------

  on(strapi, 'api::documents.signed-document-signer', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['signedDocument', 'signer']);

    const documentId = effectiveRelation(data, current, 'signedDocument');
    const signerId = effectiveRelation(data, current, 'signer');
    const signOrder = effective<number>(data, current, 'signOrder');
    const state = effective<string>(data, current, 'state');

    // Un mismo firmante no se repite en el documento.
    if (documentId && signerId) {
      await assertNoDuplicate(
        strapi,
        'api::documents.signed-document-signer',
        { signedDocument: { documentId }, signer: { documentId: signerId } },
        ctx.params.documentId,
        'Ese firmante ya está en el documento'
      );
    }

    // Si el documento exige orden de firma, cada firmante necesita su posición.
    if (documentId && signOrder == null) {
      const doc = await strapi.documents('api::documents.signed-document').findOne({
        documentId,
      });
      if ((doc as any)?.isSequential) {
        throw new ValidationError(
          'El documento es de firma secuencial: cada firmante necesita signOrder'
        );
      }
    }

    if (state === 'signed') {
      if (!effective(data, current, 'signatureMethod')) {
        throw new ValidationError('Un firmante que firma debe indicar el método de firma');
      }
      if (!effective(data, current, 'signedAt')) {
        data.signedAt = new Date().toISOString();
        ctx.params.data = data;
      }
    }

    return next();
  });

  // ---- api::documents.signed-document-event -------------------------------

  // Registro de auditoría: se escribe una vez y no se toca nunca más.
  on(strapi, 'api::documents.signed-document-event', ['update', 'delete'], async () => {
    throw new ValidationError(
      'Los eventos de un documento son un registro de auditoría: no se pueden modificar ni borrar'
    );
  });
};
