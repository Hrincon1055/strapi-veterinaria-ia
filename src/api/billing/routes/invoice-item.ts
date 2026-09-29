import { factories } from '@strapi/strapi';

/**
 * Renglones de factura. El cliente los lee a través de su factura (para eso
 * necesita permiso de lectura aquí, o el saneado los quitaría del populate) y
 * `is-owner` los acota a sus facturas. Crear o cambiar renglones es cosa del
 * staff, desde el panel.
 */
const ownerOnly = { policies: ['global::is-owner'] };

export default factories.createCoreRouter('api::billing.invoice-item', {
  config: { find: ownerOnly, findOne: ownerOnly, update: ownerOnly, delete: ownerOnly },
});
