import type { Core } from '@strapi/strapi';
import { toDocumentId, ValidationError, type DocumentContext } from './helpers';

/**
 * Strapi no admite `required: true` en atributos de tipo relation, así que la
 * obligatoriedad se aplica aquí (sección 8 del documento de modelo).
 *
 * En `create` la relación debe venir con valor. En `update` solo se comprueba
 * si el cliente la incluye: enviarla vacía equivale a desvincularla y eso no
 * está permitido en estas relaciones.
 */
export const REQUIRED_RELATIONS: Record<string, string[]> = {
  'api::shared.contact': ['profile'],
  'api::shared.verification-code': ['contact'],
  'api::customer.customer': ['profile'],
  // `author` lo rellena el controlador con el usuario autenticado.
  'api::customer.customer-note': ['customer', 'author'],
  'api::pet.pet': ['owner', 'species'],
  'api::pet.breed': ['species'],
  'api::clinical.consultation': ['pet', 'vet'],
  'api::clinical.vaccine': ['species'],
  'api::clinical.pet-vaccination': ['pet', 'vaccine'],
  'api::clinical.allergy': ['pet'],
  'api::scheduling.appointment': ['pet', 'responsible'],
  'api::scheduling.service': ['category'],
  'api::scheduling.consultation-service': ['consultation', 'service'],
  'api::billing.plan-benefit': ['plan'],
  'api::billing.subscription': ['customer', 'pet', 'plan'],
  'api::billing.benefit-usage': ['subscription', 'benefit'],
  'api::billing.invoice': ['customer'],
  'api::travel.travel-case': ['pet', 'destinationCountry'],
  'api::documents.signed-document-signer': ['signedDocument', 'signer'],
  'api::documents.signed-document-event': ['signedDocument'],
  'api::marketing.campaign-metric': ['campaign'],
  'api::notification.notification-recipient': ['notification', 'recipient'],
  'api::notification.notification-delivery': ['recipient'],
};

export default (strapi: Core.Strapi): void => {
  strapi.documents.use(async (ctx: any, next: any) => {
    const required = REQUIRED_RELATIONS[ctx.uid];
    if (!required || !['create', 'update'].includes(ctx.action)) return next();

    const data = (ctx as DocumentContext).params?.data ?? {};

    for (const field of required) {
      const provided = field in data;
      if (ctx.action === 'update' && !provided) continue;

      const value = toDocumentId(data[field]);
      if (value === null || value === undefined) {
        throw new ValidationError(`El campo "${field}" es obligatorio en ${ctx.uid}`);
      }
    }

    return next();
  });
};
