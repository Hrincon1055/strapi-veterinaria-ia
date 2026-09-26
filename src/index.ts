import type { Core } from '@strapi/strapi';

import registerValidations from './validations';
import ensureIndexes from './bootstrap/indexes';
import seedCatalogs from './bootstrap/seed';
import setupRoles from './bootstrap/roles';

export default {
  /**
   * Las reglas de negocio se registran antes de que arranque la aplicación,
   * para que ninguna escritura pueda esquivarlas: los middlewares del Document
   * Service se aplican tanto a la API REST como al panel de administración.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    registerValidations(strapi);
  },

  /**
   * Con el esquema ya sincronizado: índices de negocio, roles nativos de
   * users-permissions y catálogos mínimos. Los tres pasos son idempotentes.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureIndexes(strapi);
    await setupRoles(strapi);
    await seedCatalogs(strapi);
  },
};
