import { factories } from '@strapi/strapi';

/**
 * Horarios de atención. Es una ruta de gestión: la usan recepción y la
 * administración, no los clientes — un cliente ve los huecos por
 * `/api/availability`, no el horario en crudo. Por eso no lleva policy de
 * propiedad: el permiso del rol ya lo acota.
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
          staff: { fields: ['username', 'email'] },
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
