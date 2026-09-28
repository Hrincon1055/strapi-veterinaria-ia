/**
 * `query-defaults` middleware
 *
 * Creado a mano con la plantilla de `strapi generate middleware` (el generador
 * es interactivo y no se puede ejecutar sin terminal).
 */

import type { Core } from '@strapi/strapi';

/**
 * Pone valores por defecto de consulta y traduce atajos legibles a filtros.
 *
 * Nace de medir lo que la app tiene que escribir hoy para pedir la historia
 * clínica de una mascota en un rango de fechas:
 *
 *   ?filters[pet][documentId][$eq]=xxx
 *   &filters[consultedAt][$gte]=2025-01-01
 *   &filters[consultedAt][$lte]=2025-12-31
 *   &sort=consultedAt:desc
 *
 * y que con este middleware queda:
 *
 *   ?pet=xxx&desde=2025-01-01&hasta=2025-12-31
 *
 * Se configura por ruta, así que un solo middleware sirve para consultas,
 * vacunas, citas, facturas y viajes, cada una con su campo de fecha y su orden.
 *
 * Reglas de convivencia con el cliente:
 * - `sort` y `populate` solo se ponen si el cliente NO mandó los suyos. Quien
 *   quiera otra cosa, la pide y manda.
 * - Los filtros de los atajos se COMBINAN con los que ya venga, nunca los
 *   pisan.
 * - El atajo se borra de la query después de traducirlo: con
 *   `strictParams: true` un parámetro que Strapi no conoce hace fallar la
 *   petición entera.
 */

export type AtajoConfig = {
  /** Campo del content type al que apunta el atajo. */
  campo: string;
  /** Operador de Strapi. Por defecto `$eq`. */
  operador?: string;
  /** Si el campo es una relación, subcampo por el que comparar (p. ej. `documentId`). */
  relacionPor?: string;
};

export type DefaultsBase = {
  sort?: string;
  populate?: Record<string, unknown>;
  /** Nombre del parámetro amigable -> a dónde va. */
  atajos?: Record<string, AtajoConfig>;
};

export type QueryDefaultsConfig = DefaultsBase & {
  /**
   * Ajustes por tipo de rol de users-permissions. Se fusionan sobre la base.
   * En la práctica solo hay `client`: el staff trabaja en el panel y la base
   * es la de las integraciones con token de API, que no tienen rol.
   *
   * No es cosmético: una integración y el cliente miran los mismos datos con
   * intenciones opuestas. En la agenda, la integración quiere la próxima cita
   * primero y el cliente su historial más reciente primero. Y poblar
   * `pet.owner` para un cliente es trabajo tirado: el saneado lo descarta
   * porque no puede leer `customer`.
   *
   * El rol está disponible aquí porque la autenticación corre antes que los
   * middlewares de ruta. La propiedad (`ctx.state.ownership`) NO lo está: la
   * pone la policy, que corre después.
   */
  porRol?: Record<string, DefaultsBase>;
};

/** Construye el fragmento de filtro que corresponde a un atajo. */
function filtroDe(atajo: AtajoConfig, valor: string) {
  const comparacion = { [atajo.operador ?? '$eq']: valor };
  return atajo.relacionPor
    ? { [atajo.campo]: { [atajo.relacionPor]: comparacion } }
    : { [atajo.campo]: comparacion };
}

/** Fusiona la base con lo que diga el rol de quien pregunta. */
function resolverConfig(config: QueryDefaultsConfig, rol: string | undefined): DefaultsBase {
  const delRol = rol ? config.porRol?.[rol] : undefined;
  if (!delRol) return config;

  return {
    sort: delRol.sort ?? config.sort,
    populate: delRol.populate ?? config.populate,
    atajos: { ...(config.atajos ?? {}), ...(delRol.atajos ?? {}) },
  };
}

export default (config: QueryDefaultsConfig, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<any>) => {
    const query = { ...(ctx.query ?? {}) };
    const efectiva = resolverConfig(config, ctx.state?.user?.role?.type);

    // --- atajos -> filtros ---
    const nuevos: any[] = [];
    for (const [parametro, atajo] of Object.entries(efectiva.atajos ?? {})) {
      const valor = query[parametro];
      if (valor === undefined || valor === '') continue;

      nuevos.push(filtroDe(atajo, String(valor)));
      // Imprescindible: `strictParams` rechaza cualquier clave desconocida.
      delete query[parametro];
    }

    if (nuevos.length > 0) {
      query.filters = query.filters ? { $and: [query.filters, ...nuevos] } : { $and: nuevos };
    }

    // --- valores por defecto, solo si el cliente no pidió los suyos ---
    if (efectiva.sort && !query.sort) {
      query.sort = efectiva.sort;
    }

    if (efectiva.populate && !query.populate) {
      query.populate = { ...efectiva.populate };
    }

    ctx.query = query;
    await next();
  };
};
