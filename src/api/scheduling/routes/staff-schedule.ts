import { factories } from '@strapi/strapi';

/**
 * Horarios de atención. Es una ruta de gestión, no de clientes — un cliente
 * ve los huecos por `/api/availability`, no el horario en crudo. Recepción y
 * la administración los gestionan en el panel; por la API solo llegan
 * integraciones con token. Por eso no lleva policy de propiedad.
 *
 * Sin populate de las franjas la respuesta trae el horario sin sus horas, que
 * es justo lo que se viene a consultar.
 */
const lectura = {
  middlewares: [
    {
      name: 'global::query-defaults',
      config: {
        sort: 'validFrom:desc',
        populate: {
          staff: { fields: ['firstname', 'lastname'] },
          room: true,
          shifts: { populate: ['room'] },
        },
        atajos: {
          staff: { campo: 'staff', relacionPor: 'documentId' },
          consultorio: { campo: 'room', relacionPor: 'documentId' },
          activo: { campo: 'isActive' },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::scheduling.staff-schedule', {
  config: { find: lectura, findOne: lectura },
});
