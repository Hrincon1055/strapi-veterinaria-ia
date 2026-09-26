/**
 * `populate-segment` middleware
 *
 * Creado a mano con la plantilla de `strapi generate middleware` (el generador
 * es interactivo y no se puede ejecutar sin terminal).
 */

import type { Core } from '@strapi/strapi';

/**
 * Rellena la dynamic zone `segment` de la campaña.
 *
 * Tercera zona del proyecto y tercera vez que hace falta: `populate=*` no
 * alcanza a los componentes de una zona. Sin esto, editar una campaña en el
 * panel mostraría el segmento vacío y quien lo guardara borraría las reglas
 * sin enterarse.
 *
 * Tres de las seis reglas apuntan a un catálogo (especie, plan, vacuna) y
 * necesitan su populate interno; si no, el traductor de
 * `services/campaign.ts` recibe la relación sin resolver y no sabe contra qué
 * filtrar.
 */

const REGLAS = {
  'marketing.rule-species': { populate: ['species'] },
  'marketing.rule-subscription': { populate: ['plan'] },
  'marketing.rule-vaccination-due': { populate: ['vaccine'] },
  'marketing.rule-last-visit': true,
  'marketing.rule-city': true,
  'marketing.rule-referral': true,
};

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<any>) => {
    const query = ctx.query ?? {};
    const pidio = query.populate && query.populate !== '*';
    const yaPidio =
      pidio &&
      (Array.isArray(query.populate)
        ? query.populate.includes('segment')
        : typeof query.populate === 'object'
          ? 'segment' in query.populate
          : query.populate === 'segment');

    if (!yaPidio) {
      const base =
        pidio && typeof query.populate === 'object' && !Array.isArray(query.populate)
          ? query.populate
          : {};
      ctx.query = { ...query, populate: { ...base, segment: { on: REGLAS } } };
    }

    await next();
  };
};
