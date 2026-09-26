import { factories } from '@strapi/strapi';

/**
 * Las alergias se consultan casi siempre como "las activas de esta mascota",
 * que es lo primero que un veterinario mira antes de recetar.
 *
 *   antes:  ?filters[pet][documentId][$eq]=xxx&filters[isActive][$eq]=true
 *   ahora:  ?pet=xxx&activa=true
 */
const ownerOnly = { policies: ['global::is-owner'] };

const lectura = {
  ...ownerOnly,
  middlewares: [
    // Valida el rango antes de que query-defaults lo traduzca a filtros.
    'global::date-range',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'diagnosedOn:desc',
        atajos: {
          pet: { campo: 'pet', relacionPor: 'documentId' },
          activa: { campo: 'isActive' },
          gravedad: { campo: 'severity' },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::clinical.allergy', {
  config: {
    find: lectura,
    findOne: lectura,
    update: ownerOnly,
    delete: ownerOnly,
  },
});
