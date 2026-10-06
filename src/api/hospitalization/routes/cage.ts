import { factories } from '@strapi/strapi';

/**
 * Sin permisos para ningún rol de la API: el dominio de hospitalización es
 * del staff, que trabaja en el panel. Las rutas existen para un token de API
 * de acceso total (integraciones), como en el resto del modelo.
 */
export default factories.createCoreRouter('api::hospitalization.cage' as any);
