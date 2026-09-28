import { factories } from '@strapi/strapi';

// El autor lo fija `src/validations/actor.ts` con la sesión del panel.
export default factories.createCoreController('api::customer.customer-note');
