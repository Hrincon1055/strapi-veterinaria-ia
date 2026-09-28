/**
 * `populate-details` middleware
 *
 * Creado a mano con la plantilla de `strapi generate middleware` (el generador
 * es interactivo y no se puede ejecutar sin terminal).
 */

import type { Core } from '@strapi/strapi';

/**
 * Rellena la dynamic zone `details` del producto.
 *
 * Mismo motivo que en la historia clínica y en los viajes: una zona no se
 * puebla con `populate=*`, hay que enumerar cada componente bajo `on`. Sin
 * esto la respuesta trae `details: []` y un medicamento parece no tener
 * registro ni principio activo.
 *
 * Añadir un tipo de producto con datos propios = una entrada aquí.
 */

const DETALLES = {
  'catalog.medication-details': { populate: ['registration', 'activeIngredients'] },
  'catalog.vaccine-details': { populate: ['registration', 'vaccine'] },
  'catalog.food-details': { populate: ['registration'] },
  'catalog.accessory-details': true,
};

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<any>) => {
    const query = ctx.query ?? {};
    const pidio = query.populate && query.populate !== '*';
    const yaPidio =
      pidio &&
      (Array.isArray(query.populate)
        ? query.populate.includes('details')
        : typeof query.populate === 'object'
          ? 'details' in query.populate
          : query.populate === 'details');

    if (!yaPidio) {
      const base =
        pidio && typeof query.populate === 'object' && !Array.isArray(query.populate)
          ? query.populate
          : {};
      ctx.query = { ...query, populate: { ...base, details: { on: DETALLES } } };
    }

    await next();
  };
};
