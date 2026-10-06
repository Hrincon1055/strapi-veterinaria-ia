export const PLUGIN_ID = 'veterinaria-caja';

/** Dirección completa del punto de venta (se abre en otra pestaña). */
export const RUTA_POS = `${window.strapi?.backendURL ?? ''}/admin/plugins/${PLUGIN_ID}/pos`;
