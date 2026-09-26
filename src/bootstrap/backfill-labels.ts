import type { Core } from '@strapi/strapi';
import { LABEL_BUILDERS, refrescarEtiqueta } from '../labels';
import { includeArchived } from '../validations/archived';

/**
 * Rellena los `searchLabel` que falten.
 *
 * Hace falta porque los registros creados antes de añadir el campo lo tienen a
 * null, y un main field vacío deja el selector en blanco. Solo toca los que
 * están sin etiqueta, así que a partir del segundo arranque no hace nada.
 *
 * El orden importa: primero los perfiles, porque las etiquetas de cliente,
 * contacto, mascota y consulta se construyen a partir de ellos.
 */

const ORDEN = [
  'api::identity.profile',
  'api::customer.customer',
  'api::shared.contact',
  'api::pet.breed',
  'api::pet.pet',
  'api::clinical.consultation',
  'api::billing.subscription',
  'api::scheduling.consultation-service',
  'api::notification.notification-recipient',
  'api::marketing.campaign-metric',
];

/** Tope por content type y arranque, para que un arranque no se eternice. */
const LIMITE = 1000;

export default async (strapi: Core.Strapi): Promise<void> => {
  let total = 0;

  for (const uid of ORDEN) {
    if (!LABEL_BUILDERS[uid]) continue;

    const pendientes = await strapi.documents(uid as any).findMany({
      filters: { searchLabel: { $null: true }, ...includeArchived(uid) } as any,
      limit: LIMITE,
    } as any);

    for (const doc of pendientes) {
      if (await refrescarEtiqueta(strapi, uid, (doc as any).documentId)) total++;
    }

    if (pendientes.length === LIMITE) {
      strapi.log.warn(
        `[labels] ${uid}: quedan etiquetas por rellenar; se completarán en el próximo arranque`
      );
    }
  }

  if (total > 0) {
    strapi.log.info(`[labels] ${total} etiquetas de búsqueda generadas`);
  }
};
