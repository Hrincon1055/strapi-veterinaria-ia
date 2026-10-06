import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ValidationError } = errors;

/**
 * El cliente ve su hospitalización, no la hoja interna (5.6, Portal).
 *
 * Users-permissions concede leer un content type entero; no tiene permisos por
 * campo. Así que para el rol `client` la consulta se rehace aquí, con una
 * lista blanca: lo que llegue en `fields` o `populate` se ignora. Y como un
 * filtro sobre un campo oculto también revela su contenido
 * (`filters[reason][$contains]=…` dice si la palabra está), los filtros solo
 * pueden mencionar campos de la lista.
 *
 * El motivo, las notas de ingreso, la jaula y quién atendió son internos.
 */
const CAMPOS_CLIENTE = [
  'admittedAt', 'state', 'dischargeType', 'dischargedAt', 'dischargeSummary', 'homeInstructions', 'followUpOn',
];
const POPULATE_CLIENTE = { pet: { fields: ['name'] }, dischargeMedications: true };
const FILTRABLES = new Set([...CAMPOS_CLIENTE, 'pet', 'documentId', 'id', 'name']);

/** Lanza si el árbol de filtros menciona un campo fuera de la lista. */
function exigirFiltrosPermitidos(filtros: unknown, ruta = ''): void {
  if (!filtros || typeof filtros !== 'object') return;
  if (Array.isArray(filtros)) {
    filtros.forEach((f) => exigirFiltrosPermitidos(f, ruta));
    return;
  }
  for (const [clave, valor] of Object.entries(filtros as Record<string, unknown>)) {
    if (!clave.startsWith('$') && !FILTRABLES.has(clave)) {
      throw new ValidationError(`No se puede filtrar por "${ruta}${clave}"`);
    }
    exigirFiltrosPermitidos(valor, clave.startsWith('$') ? ruta : `${ruta}${clave}.`);
  }
}

const esCliente = (ctx: any): boolean => ctx.state?.user?.role?.type === 'client';

function acotarParaCliente(ctx: any): void {
  const q = ctx.query ?? {};
  exigirFiltrosPermitidos(q.filters);
  ctx.query = {
    filters: q.filters,
    sort: q.sort ?? 'admittedAt:desc',
    pagination: q.pagination,
    fields: CAMPOS_CLIENTE,
    populate: POPULATE_CLIENTE,
  };
}

export default factories.createCoreController('api::hospitalization.hospitalization' as any, () => ({
  async find(ctx: any) {
    if (esCliente(ctx)) acotarParaCliente(ctx);
    return super.find(ctx);
  },

  async findOne(ctx: any) {
    if (esCliente(ctx)) acotarParaCliente(ctx);
    return super.findOne(ctx);
  },
}));
