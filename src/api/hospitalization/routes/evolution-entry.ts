import { factories } from '@strapi/strapi';

/** Solo staff (panel) y tokens de API: ningún rol de users-permissions lo lee. */
export default factories.createCoreRouter('api::hospitalization.evolution-entry' as any);
