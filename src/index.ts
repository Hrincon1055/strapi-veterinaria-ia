import type { Core } from '@strapi/strapi';

import registerValidations from './validations';
import backfillLabels from './bootstrap/backfill-labels';
import backfillLineKeys from './bootstrap/backfill-line-keys';
import ensureIndexes from './bootstrap/indexes';
import setupAdminRoles from './bootstrap/admin-roles';
import setFieldLabels from './bootstrap/field-labels';
import setMainFields from './bootstrap/main-fields';
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
   * Con el esquema ya sincronizado: índices, roles (Cliente en
   * users-permissions, staff en el panel), catálogos, etiquetas de búsqueda y
   * configuración del panel. Todos los pasos son idempotentes.
   * El orden importa: las etiquetas se rellenan antes de declararlas como
   * main field, para que ningún selector quede en blanco.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureIndexes(strapi);
    await setupRoles(strapi);
    await setupAdminRoles(strapi);
    await seedCatalogs(strapi);
    await backfillLabels(strapi);
    await backfillLineKeys(strapi);
    await setMainFields(strapi);
    await setFieldLabels(strapi);
  },
};
