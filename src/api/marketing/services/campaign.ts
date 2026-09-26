import { factories } from '@strapi/strapi';

/**
 * Resolver el público de una campaña.
 *
 * `segmentCriteria` es un filtro de Strapi en JSON que se aplica sobre
 * `api::customer.customer`. Sea cual sea ese filtro, solo entran clientes que
 * dieron consentimiento de marketing y que no estén archivados: el
 * consentimiento no es negociable desde el criterio del segmento.
 */
export default factories.createCoreService('api::marketing.campaign', ({ strapi }) => ({
  async resolveAudience(campaignDocumentId: string) {
    const campaign = await strapi.documents('api::marketing.campaign').findOne({
      documentId: campaignDocumentId,
    });

    if (!campaign) return [];

    const criteria = (campaign as any).segmentCriteria ?? {};
    const consented = { consents: { marketing: true } };

    return strapi.documents('api::customer.customer').findMany({
      filters: { $and: [criteria, consented] } as any,
      populate: ['profile'] as any,
    });
  },
}));
