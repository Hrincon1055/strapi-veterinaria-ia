/**
 * `populate-requirements` middleware
 *
 * Creado a mano con la plantilla de `strapi generate middleware` (el generador
 * es interactivo y no se puede ejecutar sin terminal).
 */

import type { Core } from '@strapi/strapi';

/**
 * Rellena la dynamic zone `requirements` del caso de viaje.
 *
 * Mismo motivo que en la historia clínica: una zona no se puebla con
 * `populate=*`, hay que enumerar cada componente bajo `on`. Si se olvida, la
 * respuesta trae `requirements: []` y el caso parece no tener requisitos
 * cuando los tiene todos.
 *
 * Los siete llevan `document` (media) y `verifiedBy`, así que todos necesitan
 * su populate interno.
 */

const INTERNO = { populate: ['document', 'verifiedBy'] };

const REQUISITOS = {
  'travel.health-certificate': INTERNO,
  'travel.rabies-titer': INTERNO,
  'travel.microchip-check': INTERNO,
  'travel.antiparasitic': INTERNO,
  'travel.import-permit': INTERNO,
  'travel.crate': INTERNO,
  'travel.other-requirement': INTERNO,
};

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<any>) => {
    const query = ctx.query ?? {};
    const pidio = query.populate && query.populate !== '*';
    const yaPidio =
      pidio &&
      (Array.isArray(query.populate)
        ? query.populate.includes('requirements')
        : typeof query.populate === 'object'
          ? 'requirements' in query.populate
          : query.populate === 'requirements');

    if (!yaPidio) {
      const base =
        pidio && typeof query.populate === 'object' && !Array.isArray(query.populate)
          ? query.populate
          : {};
      ctx.query = { ...query, populate: { ...base, requirements: { on: REQUISITOS } } };
    }

    await next();
  };
};
