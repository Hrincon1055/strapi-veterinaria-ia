import { randomUUID } from 'node:crypto';
import type { Core } from '@strapi/strapi';

/**
 * Pone `lineKey` a las líneas de consulta creadas antes de que existiera.
 *
 * Va directo a la tabla del componente y no por el Document Service: para que
 * el middleware de `validations/clinical.ts` la asignara habría que reescribir
 * la zona `lines` entera de cada consulta, reenviando cada relación, solo para
 * añadir una columna. Aquí no hay regla de negocio que saltarse: la clave es
 * un UUID nuevo y nada la referencia todavía.
 *
 * Solo toca las que están a null, así que desde el segundo arranque no hace
 * nada.
 */
const COMPONENTES = ['clinical.service-line', 'clinical.product-line'];

export default async (strapi: Core.Strapi): Promise<void> => {
  let total = 0;

  for (const uid of COMPONENTES) {
    const sinClave = await strapi.db.query(uid as any).findMany({
      where: { lineKey: null },
      select: ['id'],
    });
    for (const { id } of sinClave) {
      await strapi.db.query(uid as any).update({ where: { id }, data: { lineKey: randomUUID() } });
      total++;
    }
  }

  if (total > 0) {
    strapi.log.info(`[line-keys] ${total} líneas de consulta con clave de trazabilidad nueva`);
  }
};
