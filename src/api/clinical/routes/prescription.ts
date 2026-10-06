import { factories } from '@strapi/strapi';

/**
 * Solo staff (panel) y tokens de API: ningún rol de users-permissions la lee.
 * Se emite y se anula por el plugin `veterinaria-historia`, que delega en
 * `api::clinical.prescribing`.
 */
export default factories.createCoreRouter('api::clinical.prescription' as any);
