import { factories } from '@strapi/strapi';

// `bookedBy` (el perfil de quien agenda) lo fija `src/validations/actor.ts`,
// tanto si reserva el cliente por la API como si lo hace recepción en el panel.
export default factories.createCoreController('api::scheduling.appointment');
