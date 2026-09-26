import { factories } from '@strapi/strapi';

/**
 * La agenda es la pantalla más usada de la clínica, y la miran dos perfiles
 * con intenciones opuestas:
 *
 * - **Recepción y veterinarios** trabajan hacia adelante: quieren la próxima
 *   cita primero y necesitan ver de quién es la mascota para llamar al
 *   propietario. Su día empieza con `?hoy=true`.
 * - **El cliente** mira hacia atrás: su historial de citas, la más reciente
 *   primero. Poblarle el propietario no sirve de nada — es él mismo, y
 *   además el saneado lo descartaría porque no puede leer `customer`.
 *
 * Por eso el orden y el populate cambian según el rol. El rol está
 * disponible en un middleware de ruta porque la autenticación corre antes.
 */
const ownerOnly = { policies: ['global::is-owner'] };

/** Lo que el staff necesita ver de un vistazo en la agenda. */
const PARA_STAFF = {
  pet: { populate: { owner: { populate: ['profile'] } } },
  responsible: { fields: ['username', 'email'] },
  room: true,
  services: { populate: ['service'] },
};

/** El cliente ve su cita, no la ficha comercial de sí mismo. */
const PARA_CLIENTE = {
  pet: true,
  room: true,
  services: { populate: ['service'] },
};

const lectura = {
  ...ownerOnly,
  middlewares: [
    // Expande ?hoy= / ?semana= a desde/hasta y valida el rango.
    'global::date-range',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'startAt:desc',
        populate: PARA_STAFF,
        atajos: {
          pet: { campo: 'pet', relacionPor: 'documentId' },
          responsable: { campo: 'responsible', relacionPor: 'documentId' },
          consultorio: { campo: 'room', relacionPor: 'documentId' },
          estado: { campo: 'state' },
          origen: { campo: 'source' },
          desde: { campo: 'startAt', operador: '$gte' },
          hasta: { campo: 'startAt', operador: '$lte' },
        },
        porRol: {
          // La agenda del día se lee hacia adelante.
          receptionist: { sort: 'startAt:asc' },
          veterinarian: { sort: 'startAt:asc' },
          clinic_admin: { sort: 'startAt:asc' },
          client: { sort: 'startAt:desc', populate: PARA_CLIENTE },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::scheduling.appointment', {
  config: {
    find: lectura,
    findOne: lectura,
    update: ownerOnly,
    delete: ownerOnly,
  },
});
