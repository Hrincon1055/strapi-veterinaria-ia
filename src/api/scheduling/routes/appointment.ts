import { factories } from '@strapi/strapi';

/**
 * La agenda la leen por esta API dos tipos de consumidor con intenciones
 * opuestas:
 *
 * - **Integraciones con token de API** trabajan hacia adelante, como la
 *   recepción: la próxima cita primero y de quién es la mascota. El staff ya
 *   no pasa por aquí: trabaja en el panel con cuentas `admin::user`.
 * - **El cliente** mira hacia atrás: su historial de citas, la más reciente
 *   primero. Poblarle el propietario no sirve de nada — es él mismo, y
 *   además el saneado lo descartaría porque no puede leer `customer`.
 *
 * Por eso el orden y el populate cambian según el rol. El rol está
 * disponible en un middleware de ruta porque la autenticación corre antes.
 */
const ownerOnly = { policies: ['global::is-owner'] };

/**
 * Lo que una integración necesita ver de un vistazo en la agenda.
 * `responsible` es un `admin::user`: el saneado de la API solo lo deja pasar
 * con un token de acceso total (ningún rol de users-permissions tiene
 * `admin::user.find`). Solo nombre y apellido: su `email` es `private`, y con
 * `strictParams` pedir un campo privado en un populate no se descarta, hace
 * fallar la petición entera con 400 "Invalid key email" — también la del
 * cliente, aunque a él la relación se le quite después.
 */
const PARA_STAFF = {
  pet: { populate: { owner: { populate: ['profile'] } } },
  responsible: { fields: ['firstname', 'lastname'] },
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
        // La agenda del día se lee hacia adelante.
        sort: 'startAt:asc',
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
