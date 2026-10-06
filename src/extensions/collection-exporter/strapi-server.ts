import type { Core } from '@strapi/strapi';

/**
 * Restricciones sobre `strapi-plugin-collection-exporter` (botón "CSV/Excel"
 * en la lista del Content Manager).
 *
 * Tal como viene, el plugin es una fuga de datos dentro del panel:
 *
 *   - Sus rutas solo exigen `admin::isAuthenticatedAdmin`, no el RBAC: una
 *     cuenta de Recepción exporta alergias, proveedores o cualquier otra
 *     colección `api::` aunque su rol no la pueda leer.
 *   - Solo quita los atributos `password`. Los `private` salen tal cual
 *     (`product.referenceCost`, `subscription.paymentMethodToken`,
 *     `verification-code`…).
 *   - Puebla cada relación ENTERA con el Document Service, sin saneado: la
 *     relación `profile.user` devuelve el hash bcrypt de la contraseña del
 *     cliente, y `vet`/`responsible` los de las cuentas del panel.
 *   - La búsqueda mira todos los campos de texto, también los que el rol no
 *     puede leer, así que serviría de oráculo.
 *
 * Aquí se envuelven su controlador y su servicio (nada de su código se toca):
 *
 *   1. Solo se exportan los CATÁLOGOS de `EXPORTABLES`. Nunca tablas con datos
 *      personales: era ya la condición para el plugin CSV anterior (ver
 *      CLAUDE.md). Añadir uno aquí es decidir que se puede sacar de la clínica
 *      en un archivo.
 *   2. Además hay que poder leerlo en el Content Manager (con los alias, igual
 *      que el propio Content Manager), y solo salen los campos que el rol
 *      puede leer y que no son `private`.
 *   3. Las relaciones salen como `{ id, documentId }` (el plugin solo pinta el
 *      `id`), y solo si el rol puede leer el destino. Los medios, como `{ url }`.
 *   4. `sortBy` solo admite campos legibles, y la búsqueda solo mira esos.
 *
 * `GET /collection-exporter/content-types` devuelve solo lo que la cuenta
 * puede exportar; `src/admin/app.tsx` lo usa para ocultar el botón en el resto.
 */

const EXPORTABLES = new Set<string>([
  'api::catalog.product',
  'api::catalog.product-category',
  'api::catalog.supplier',
  'api::scheduling.service',
  'api::scheduling.service-category',
  'api::scheduling.clinic-room',
  'api::clinical.vaccine',
  'api::pet.species',
  'api::pet.breed',
  'api::shared.country',
  'api::billing.plan',
  'api::billing.plan-benefit',
]);

/** Lo que el plugin ya excluye; se respeta para no pedirle columnas que no pinta. */
const TIPOS_EXCLUIDOS = new Set(['password', 'dynamiczone', 'component']);
const SISTEMA = new Set(['createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy', 'locale', 'localizations']);
const SIEMPRE = ['id', 'documentId', 'createdAt', 'updatedAt'];

type Legibles = Map<string, { type: string; target?: string; puedeDestino: boolean }>;

const comprobador = (strapi: Core.Strapi, ctx: any, uid: string) =>
  strapi
    .plugin('content-manager')
    .service('permission-checker')
    .create({ userAbility: ctx.state.userAbility, model: uid });

/** Campos que esta cuenta puede ver de `uid`, o `null` si no puede exportarlo. */
const camposLegibles = (strapi: Core.Strapi, ctx: any, uid: string): Legibles | null => {
  const ct = (strapi.contentTypes as any)[uid];
  if (!EXPORTABLES.has(uid) || !ct || ct.kind !== 'collectionType') return null;
  if (!ctx.state.userAbility) return null;

  const checker = comprobador(strapi, ctx, uid);
  if (checker.cannot.read()) return null;

  const legibles: Legibles = new Map();
  for (const [campo, attr] of Object.entries<any>(ct.attributes)) {
    if (attr.private || TIPOS_EXCLUIDOS.has(attr.type) || SISTEMA.has(campo)) continue;
    if (!checker.can.read(null, campo)) continue;

    const puedeDestino =
      attr.type !== 'relation' || !attr.target || !comprobador(strapi, ctx, attr.target).cannot.read();
    legibles.set(campo, { type: attr.type, target: attr.target, puedeDestino });
  }
  return legibles;
};

const soloIds = (valor: any) => {
  if (!valor) return valor ?? null;
  if (Array.isArray(valor)) return valor.map((v) => ({ id: v?.id, documentId: v?.documentId }));
  return { id: valor.id, documentId: valor.documentId };
};

const soloUrl = (valor: any) => {
  if (!valor) return valor ?? null;
  if (Array.isArray(valor)) return valor.map((v) => ({ url: v?.url }));
  return { url: valor.url };
};

const sanear = (entrada: any, legibles: Legibles) => {
  const limpia: Record<string, unknown> = {};
  for (const clave of SIEMPRE) if (clave in entrada) limpia[clave] = entrada[clave];
  for (const [campo, { type, puedeDestino }] of legibles) {
    if (!(campo in entrada)) continue;
    if (type === 'relation') limpia[campo] = puedeDestino ? soloIds(entrada[campo]) : null;
    else if (type === 'media') limpia[campo] = soloUrl(entrada[campo]);
    else limpia[campo] = entrada[campo];
  }
  return limpia;
};

const filtrarAtributos = (atributos: Record<string, unknown> | undefined, legibles: Legibles) =>
  Object.fromEntries(Object.entries(atributos ?? {}).filter(([campo]) => legibles.has(campo)));

export default (plugin: any) => {
  const controladorOriginal = plugin.controllers.controller;
  const servicioOriginal = plugin.services.service;

  plugin.controllers.controller = ({ strapi }: { strapi: Core.Strapi }) => {
    const base = controladorOriginal({ strapi });

    /** Valida `uid` y `sortBy`, deja los campos legibles para el servicio y devuelve null si ya respondió. */
    const autorizar = (ctx: any): Legibles | null => {
      const uid = String(ctx.query?.uid ?? '');
      if (!uid) {
        ctx.badRequest('uid query parameter is required');
        return null;
      }
      const legibles = camposLegibles(strapi, ctx, uid);
      if (!legibles) {
        ctx.forbidden('Esta colección no se puede exportar');
        return null;
      }
      const { sortBy } = ctx.query;
      if (sortBy && !legibles.has(sortBy) && !SIEMPRE.includes(sortBy)) {
        ctx.badRequest('No se puede ordenar por ese campo');
        return null;
      }
      ctx.state.exportador = { legibles };
      return legibles;
    };

    return {
      async getContentTypes(ctx: any) {
        await base.getContentTypes(ctx);
        ctx.body = (ctx.body ?? []).flatMap((tipo: any) => {
          const legibles = camposLegibles(strapi, ctx, tipo.uid);
          return legibles ? [{ ...tipo, attributes: filtrarAtributos(tipo.attributes, legibles) }] : [];
        });
      },

      async getCollectionData(ctx: any) {
        const legibles = autorizar(ctx);
        if (!legibles) return;
        await base.getCollectionData(ctx);
        if (!ctx.body?.data) return;
        ctx.body.data = ctx.body.data.map((e: any) => sanear(e, legibles));
        ctx.body.attributes = filtrarAtributos(ctx.body.attributes, legibles);
      },

      async exportCollectionData(ctx: any) {
        const legibles = autorizar(ctx);
        if (!legibles) return;
        await base.exportCollectionData(ctx);
        if (!ctx.body?.data) return;
        ctx.body.data = ctx.body.data.map((e: any) => sanear(e, legibles));
        ctx.body.attributes = filtrarAtributos(ctx.body.attributes, legibles);
        ctx.body.headers = (ctx.body.headers ?? []).filter(
          (h: string) => legibles.has(h) || SIEMPRE.includes(h) || h === 'locale'
        );
      },
    };
  };

  // La búsqueda del plugin hace `$or` sobre todos los campos de texto; se deja
  // solo sobre los legibles, que el controlador acaba de dejar en ctx.state.
  plugin.services.service = ({ strapi }: { strapi: Core.Strapi }) => {
    const servicio = servicioOriginal({ strapi });
    const construir = servicio._buildFilters;
    servicio._buildFilters = function (contentType: any, opciones: any) {
      const filtros = construir.call(this, contentType, opciones);
      const legibles: Legibles | undefined = strapi.requestContext.get()?.state?.exportador?.legibles;
      if (filtros.$or) {
        const permitidos = legibles
          ? filtros.$or.filter((c: Record<string, unknown>) => legibles.has(Object.keys(c)[0]))
          : [];
        // Sin campos de texto legibles, una búsqueda no encuentra nada.
        filtros.$or = permitidos.length ? permitidos : [{ id: { $null: true } }];
      }
      return filtros;
    };
    return servicio;
  };

  return plugin;
};
