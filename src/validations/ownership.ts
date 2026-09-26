import type { Core } from '@strapi/strapi';
import { OWNERSHIP_RULES, type Ownership } from '../ownership';

/**
 * Filtro de propiedad para los listados del portal del cliente.
 *
 * Va en un middleware del Document Service y no en la policy por una razón
 * concreta: la policy solo puede tocar `request.query`, y eso hace pasar el
 * filtro por la validación de parámetros de entrada. Con `strictParams: true`
 * (config/api.ts) el saneado rechaza `filters[owner]`, porque el rol Cliente no
 * tiene permiso de lectura sobre `customer` y no se le deja atravesar esa
 * relación. Aquí el filtro se aplica después del saneado, sobre la consulta ya
 * validada: no es entrada del usuario, es una restricción del servidor.
 *
 * La propiedad la resuelve la policy `global::is-owner`, que la deja en
 * `ctx.state.ownership`; aquí se recoge con `strapi.requestContext`.
 */

const LIST_ACTIONS = ['findMany', 'findFirst'];

export default (strapi: Core.Strapi): void => {
  strapi.documents.use(async (ctx: any, next: any) => {
    const rule = OWNERSHIP_RULES[ctx.uid];
    if (!rule || !LIST_ACTIONS.includes(ctx.action)) return next();

    // Solo hay propiedad que aplicar dentro de la petición HTTP de un cliente.
    // Fuera de ella (bootstrap, scripts, panel de administración) no hay nada
    // en `state.ownership` y la consulta pasa intacta.
    const ownership: Ownership | undefined = strapi.requestContext.get()?.state?.ownership;
    if (!ownership) return next();

    const own = rule.filter(ownership);
    ctx.params = ctx.params ?? {};
    ctx.params.filters = ctx.params.filters ? { $and: [ctx.params.filters, own] } : own;

    return next();
  });
};
