import type { Core } from '@strapi/strapi';

/**
 * Rellena la dynamic zone `sections` de la consulta sin que el cliente tenga
 * que pedirlo.
 *
 * Una dynamic zone no se puede poblar con `populate=*`: hay que enumerar cada
 * componente bajo la clave `on`, y además los que llevan media o componentes
 * anidados necesitan su propio `populate`. Escrito a mano por el cliente eso
 * es una query de veinte líneas, fácil de equivocar y distinta en cada
 * pantalla; peor aún, si se olvida, la respuesta trae `sections: []` y parece
 * que la consulta está vacía cuando no lo está.
 *
 * Al ponerlo en un middleware de ruta, la app móvil pide `GET /api/consultations`
 * a secas y recibe la historia completa.
 *
 * Si el cliente manda su propio `populate`, se respeta: puede querer solo un
 * trozo. Solo se inyecta lo que no haya pedido.
 */

/** Cada componente de la zona con lo que necesita poblar por dentro. */
const SECCIONES = {
  'clinical.anamnesis': true,
  'clinical.physical-exam': true,
  'clinical.diagnosis': true,
  'clinical.procedure': true,
  // Llevan media o componentes anidados: hay que decirlo explícitamente.
  'clinical.lab-result': { populate: ['report'] },
  'clinical.imaging': { populate: ['images'] },
  'clinical.treatment-plan': { populate: ['medications'] },
} as const;

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<any>) => {
    const query = ctx.query ?? {};

    // `populate=*` no alcanza a los componentes de una dynamic zone, así que
    // también se sustituye por el mapa explícito.
    const pidioPopulate = query.populate && query.populate !== '*';
    const yaPidioSecciones =
      pidioPopulate &&
      (Array.isArray(query.populate)
        ? query.populate.includes('sections')
        : typeof query.populate === 'object'
          ? 'sections' in query.populate
          : query.populate === 'sections');

    if (!yaPidioSecciones) {
      const base =
        pidioPopulate && typeof query.populate === 'object' && !Array.isArray(query.populate)
          ? query.populate
          : {};

      ctx.query = {
        ...query,
        populate: { ...base, sections: { on: SECCIONES } },
      };
    }

    await next();
  };
};
