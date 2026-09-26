import type { Core } from '@strapi/strapi';

/**
 * Content types con `archivedAt`: "eliminar" en la app es un update que fija
 * `archivedAt`, no un delete. Las lecturas ocultan lo archivado salvo que la
 * consulta mencione `archivedAt` explícitamente (para pantallas de papelera).
 */
export const ARCHIVABLE_UIDS = [
  'api::identity.profile',
  'api::customer.customer',
  'api::pet.pet',
  'api::clinical.consultation',
  'api::documents.signed-document',
  'api::billing.invoice',
];

const READ_ACTIONS = ['findMany', 'findFirst', 'findOne'];

/**
 * Filtro que no descarta nada pero menciona `archivedAt`, para que el filtro
 * de arriba deje pasar la consulta intacta: las lecturas internas sí tienen
 * que ver los documentos archivados.
 *
 * Solo se aplica a los content types que tienen el campo; en los demás Strapi
 * rechazaría la consulta con "Invalid key archivedAt".
 */
export const includeArchived = (uid: string): Record<string, any> =>
  ARCHIVABLE_UIDS.includes(uid)
    ? { $or: [{ archivedAt: { $null: true } }, { archivedAt: { $null: false } }] }
    : {};

/** Busca `archivedAt` en cualquier nivel del árbol de filtros, incluidos $and/$or. */
function mentionsArchivedAt(filters: unknown): boolean {
  if (!filters || typeof filters !== 'object') return false;
  if (Array.isArray(filters)) return filters.some(mentionsArchivedAt);
  return Object.entries(filters as Record<string, unknown>).some(
    ([key, value]) => key === 'archivedAt' || mentionsArchivedAt(value)
  );
}

export default (strapi: Core.Strapi): void => {
  strapi.documents.use(async (ctx: any, next: any) => {
    if (!ARCHIVABLE_UIDS.includes(ctx.uid) || !READ_ACTIONS.includes(ctx.action)) {
      return next();
    }

    const filters = ctx.params?.filters;
    if (mentionsArchivedAt(filters)) return next();

    ctx.params = ctx.params ?? {};
    ctx.params.filters = filters
      ? { $and: [filters, { archivedAt: { $null: true } }] }
      : { archivedAt: { $null: true } };

    return next();
  });
};
