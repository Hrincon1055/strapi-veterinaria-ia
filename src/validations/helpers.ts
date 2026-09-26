import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';

export const { ValidationError } = errors;

/**
 * Contexto del middleware del Document Service. Strapi no exporta un tipo
 * público para él, así que se declara aquí con lo que realmente usamos.
 */
export type DocumentContext = {
  uid: string;
  action: string;
  params: Record<string, any>;
};

export type Middleware = (ctx: DocumentContext, next: () => Promise<any>) => Promise<any>;

export const WRITE_ACTIONS = ['create', 'update'];
export const READ_ACTIONS = ['findMany', 'findFirst', 'findOne'];

export const isWrite = (ctx: DocumentContext) => WRITE_ACTIONS.includes(ctx.action);

/**
 * Normaliza el valor de una relación entrante a un documentId.
 * El Document Service acepta varias formas: documentId suelto, objeto,
 * array, o los operadores set/connect/disconnect.
 *
 * Devuelve `undefined` si la relación no viene en los datos (no tocar),
 * `null` si se está limpiando, o el documentId.
 *
 * DECISIÓN: un id numérico se trata como documentId en texto. En Strapi 5 la
 * API pública trabaja con documentId; aceptar números solo evita romper
 * clientes que envíen el id interno.
 */
export function toDocumentId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? null : toDocumentId(value[value.length - 1]);
  }
  if (typeof value === 'object') {
    const v = value as Record<string, any>;
    if (v.documentId !== undefined) return String(v.documentId);
    if (v.set !== undefined) return toDocumentId(v.set);
    if (v.connect !== undefined) return toDocumentId(v.connect);
    if (v.disconnect !== undefined) return null;
    if (v.id !== undefined) return String(v.id);
  }
  return undefined;
}

/**
 * En `update` hay que validar el resultado de fusionar lo que llega con lo que
 * ya está guardado: una regla que compare dos campos no puede fiarse solo de
 * los datos entrantes.
 */
export async function loadCurrent(
  strapi: Core.Strapi,
  ctx: DocumentContext,
  populate: string[] = []
): Promise<any | null> {
  if (ctx.action !== 'update' || !ctx.params?.documentId) return null;
  return strapi.documents(ctx.uid as any).findOne({
    documentId: ctx.params.documentId,
    populate: populate as any,
  });
}

/** Valor efectivo de un campo escalar tras aplicar los datos entrantes. */
export function effective<T = any>(data: any, current: any, key: string): T | undefined {
  return data && key in data ? data[key] : current?.[key];
}

/** Valor efectivo de una relación, como documentId. Requiere `key` poblado en `current`. */
export function effectiveRelation(data: any, current: any, key: string): string | null | undefined {
  if (data && key in data) return toDocumentId(data[key]);
  const cur = current?.[key];
  if (cur === undefined || cur === null) return cur === null ? null : undefined;
  return cur.documentId ?? null;
}

/** Lanza ValidationError si ya existe otro documento que cumpla `filters`. */
export async function assertNoDuplicate(
  strapi: Core.Strapi,
  uid: string,
  filters: Record<string, any>,
  currentDocumentId: string | undefined,
  message: string
): Promise<void> {
  const dup = await strapi.documents(uid as any).findFirst({
    filters: {
      ...filters,
      ...(currentDocumentId ? { documentId: { $ne: currentDocumentId } } : {}),
    } as any,
    status: 'published' as any,
  });
  if (dup) throw new ValidationError(message);
}

/** Fecha (YYYY-MM-DD) de hoy, para comparar campos `date` sin desfase de zona horaria. */
export const today = (): string => new Date().toISOString().slice(0, 10);

/** Compara dos fechas `date` o `datetime`; devuelve true si a es estrictamente posterior a b. */
export function isAfter(a: string | Date | undefined | null, b: string | Date | undefined | null): boolean {
  if (!a || !b) return false;
  return new Date(a).getTime() > new Date(b).getTime();
}

/**
 * Registra un middleware que solo actúa sobre un UID y unas acciones dadas.
 * Evita repetir la misma guarda en cada regla.
 */
export function on(
  strapi: Core.Strapi,
  uid: string,
  actions: string[],
  handler: (ctx: DocumentContext, next: () => Promise<any>) => Promise<any>
): void {
  strapi.documents.use(async (ctx: any, next: any) => {
    if (ctx.uid !== uid || !actions.includes(ctx.action)) return next();
    return handler(ctx as DocumentContext, next);
  });
}
