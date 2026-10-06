import { factories } from '@strapi/strapi';

/** Solo staff (panel, por el punto de venta) y tokens de API: ningún rol de users-permissions lo lee. */
export default factories.createCoreRouter('api::cash.cash-movement' as any);
