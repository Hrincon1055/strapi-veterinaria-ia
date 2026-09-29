import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { includeArchived } from './archived';

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
 * El panel manda las relaciones como diferencia (`{ connect, disconnect }`), y
 * al guardar un formulario en el que la relación no se tocó llegan las dos
 * listas vacías. Eso significa "sin cambios", no "se está limpiando".
 */
export const esDiferenciaVacia = (v: any): boolean =>
  !!v && typeof v === 'object' && !Array.isArray(v) &&
  // Sin ninguna de las dos listas no es una diferencia: puede ser el propio
  // elemento `{ id, documentId }` de dentro de un `connect`.
  (v.connect !== undefined || v.disconnect !== undefined) &&
  (v.connect === undefined || (Array.isArray(v.connect) && v.connect.length === 0)) &&
  (v.disconnect === undefined || (Array.isArray(v.disconnect) && v.disconnect.length === 0)) &&
  v.set === undefined;

/**
 * Normaliza el valor de una relación entrante a un documentId.
 * El Document Service acepta varias formas: documentId suelto, objeto,
 * array, o los operadores set/connect/disconnect.
 *
 * Devuelve `undefined` si la relación no viene en los datos o llega como
 * diferencia vacía (no tocar), `null` si se está limpiando, o el documentId.
 *
 * DECISIÓN: un id numérico se trata como documentId en texto. En Strapi 5 la
 * API pública trabaja con documentId; aceptar números solo evita romper
 * clientes que envíen el id interno.
 */
export function toDocumentId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (esDiferenciaVacia(value)) return undefined;
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
 * Relación de un componente (línea repetible o bloque de dynamic zone), como
 * documentId, teniendo en cuenta cómo la manda el panel.
 *
 * El panel envía las relaciones como diferencia (`{ connect, disconnect }`):
 * en un componente que ya existía y cuya relación no se tocó llegan las dos
 * listas vacías, y `toDocumentId` lo leería como "se está limpiando". En ese
 * caso, y cuando la relación ni siquiera viene, vale la del componente
 * guardado con el mismo `id` (`previa`).
 */
export function relacionDeComponente(valor: any, previa: any, campo: string): string | null | undefined {
  const guardado = previa?.[campo]?.documentId ?? null;
  if (valor === undefined) return guardado;
  if (
    valor &&
    typeof valor === 'object' &&
    !Array.isArray(valor) &&
    Array.isArray(valor.connect) &&
    valor.connect.length === 0 &&
    (!Array.isArray(valor.disconnect) || valor.disconnect.length === 0) &&
    valor.set === undefined
  ) {
    return guardado;
  }
  return toDocumentId(valor);
}

/**
 * Componentes guardados indexados por `id`, para emparejarlos con los que
 * llegan en una actualización. En una dynamic zone los ids son por tabla de
 * componente, así que la clave incluye `__component` cuando existe.
 */
export function porId(componentes: any[] | null | undefined): Map<string, any> {
  return new Map(
    (componentes ?? []).map((c: any) => [`${c.__component ?? ''}#${c.id}`, c])
  );
}

export const previaDe = (guardadas: Map<string, any>, entrante: any): any =>
  entrante?.id != null ? guardadas.get(`${entrante.__component ?? ''}#${entrante.id}`) : undefined;

/**
 * En `update` hay que validar el resultado de fusionar lo que llega con lo que
 * ya está guardado: una regla que compare dos campos no puede fiarse solo de
 * los datos entrantes.
 */
export async function loadCurrent(
  strapi: Core.Strapi,
  ctx: DocumentContext,
  populate: string[] | Record<string, any> = []
): Promise<any | null> {
  if (ctx.action !== 'update' || !ctx.params?.documentId) return null;
  return strapi.documents(ctx.uid as any).findOne({
    documentId: ctx.params.documentId,
    populate: populate as any,
    // El filtro de archivados se aplica también a `findOne`, así que sin esto
    // una lectura interna de un documento archivado devolvería null y la
    // validación creería que se está creando. Mencionar `archivedAt` hace que
    // ese middleware no toque la consulta.
    filters: includeArchived(ctx.uid) as any,
  } as any);
}

/** Valor efectivo de un campo escalar tras aplicar los datos entrantes. */
export function effective<T = any>(data: any, current: any, key: string): T | undefined {
  return data && key in data ? data[key] : current?.[key];
}

/** Valor efectivo de una relación, como documentId. Requiere `key` poblado en `current`. */
export function effectiveRelation(data: any, current: any, key: string): string | null | undefined {
  if (data && key in data && !esDiferenciaVacia(data[key])) return toDocumentId(data[key]);
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
