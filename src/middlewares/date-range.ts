/**
 * `date-range` middleware
 *
 * Creado a mano con la plantilla de `strapi generate middleware` (el generador
 * es interactivo y no se puede ejecutar sin terminal).
 */

import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';

const { ValidationError } = errors;

/**
 * Valida el rango `?desde=&hasta=` y lo deja disponible para quien lo necesite.
 *
 * Sin esto, `?desde=lo-que-sea` acaba en un filtro `$gte` contra una columna de
 * fecha y la base compara cadenas: no falla, devuelve un resultado silencioso y
 * equivocado. En una historia clínica eso es peor que un error.
 *
 * Hace dos cosas:
 *
 * 1. Rechaza con 400 lo que no sea una fecha `YYYY-MM-DD` real, y rechaza un
 *    rango invertido (`desde` posterior a `hasta`).
 * 2. Deja el rango normalizado en `ctx.state.rango`, para los endpoints
 *    propios que no pasan por los filtros de Strapi — la búsqueda dentro de la
 *    dynamic zone, por ejemplo, resuelve en SQL y no puede usar `filters`.
 *
 * La traducción a `filters` la sigue haciendo `query-defaults`; este middleware
 * va antes en la cadena para que valide primero.
 */

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha real, no solo con forma de fecha: descarta 2025-02-30. */
function esFechaValida(valor: string): boolean {
  if (!FORMATO.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<any>) => {
    const { desde, hasta } = ctx.query ?? {};

    for (const [nombre, valor] of [
      ['desde', desde],
      ['hasta', hasta],
    ] as const) {
      if (valor === undefined || valor === '') continue;
      if (!esFechaValida(String(valor))) {
        throw new ValidationError(
          `"${nombre}" debe ser una fecha AAAA-MM-DD válida; se recibió "${valor}"`
        );
      }
    }

    if (desde && hasta && String(desde) > String(hasta)) {
      throw new ValidationError(`El rango está invertido: "desde" (${desde}) es posterior a "hasta" (${hasta})`);
    }

    ctx.state.rango = {
      desde: desde ? String(desde) : null,
      hasta: hasta ? String(hasta) : null,
    };

    await next();
  };
};
