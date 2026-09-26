/**
 * `populate-history` middleware
 *
 * Creado a mano con la plantilla de `strapi generate middleware` (el generador
 * es interactivo y no se puede ejecutar sin terminal).
 */

import type { Core } from '@strapi/strapi';

/**
 * Trae la historia clínica completa de una mascota en una sola petición.
 *
 * Sin esto, la pantalla de historia necesita cuatro llamadas —mascota,
 * consultas con sus siete secciones, vacunas y alergias— y la de consultas es
 * la query larga de la dynamic zone. Con `?historia=true` sale todo de un
 * viaje:
 *
 *   GET /api/pets/<documentId>?historia=true
 *
 * Es opcional a propósito. Aplicado siempre, el listado de mascotas del
 * portal arrastraría la historia entera de cada una: para un cliente con tres
 * mascotas y años de consultas, son cientos de filas de componentes para
 * pintar una lista de nombres. Quien necesita la historia la pide.
 *
 * `historia` se borra de la query antes de seguir: con `strictParams: true`
 * un parámetro que Strapi no conoce hace fallar la petición entera.
 */

/** Las siete secciones de la consulta, con lo que cada una necesita por dentro. */
const SECCIONES = {
  'clinical.anamnesis': true,
  'clinical.physical-exam': true,
  'clinical.diagnosis': true,
  'clinical.procedure': true,
  'clinical.lab-result': { populate: ['report'] },
  'clinical.imaging': { populate: ['images'] },
  'clinical.treatment-plan': { populate: ['medications'] },
};

const HISTORIA = {
  species: true,
  breed: true,
  photos: true,
  consultations: {
    sort: ['consultedAt:desc'],
    populate: {
      vet: { fields: ['username', 'email'] },
      appointment: { populate: ['room'] },
      sections: { on: SECCIONES },
      // Las líneas de servicio son un componente desde la migración: si no se
      // piden, la historia sale sin lo que se cobró en cada visita.
      services: { populate: ['service'] },
    },
  },
  vaccinations: {
    sort: ['appliedOn:desc'],
    populate: ['vaccine'],
  },
  allergies: {
    sort: ['diagnosedOn:desc'],
  },
};

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<any>) => {
    const query = { ...(ctx.query ?? {}) };

    if (query.historia === undefined) return next();

    const pedida = query.historia === 'true' || query.historia === true;
    delete query.historia;

    if (pedida) {
      // Se combina con lo que el cliente ya pidiera, sin pisarlo.
      query.populate =
        query.populate && typeof query.populate === 'object' && !Array.isArray(query.populate)
          ? { ...HISTORIA, ...query.populate }
          : HISTORIA;
    }

    ctx.query = query;
    await next();
  };
};
