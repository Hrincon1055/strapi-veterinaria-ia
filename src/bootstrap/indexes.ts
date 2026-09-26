import path from 'path';
import type { Core } from '@strapi/strapi';

/**
 * Asegura los índices de negocio una vez que las tablas existen.
 *
 * Strapi corre las migraciones de usuario dentro de `schema.sync`, antes de
 * crear las tablas de los content types, así que en una base de datos nueva la
 * migración no puede crearlos. Aquí se crean en `bootstrap()`, cuando el
 * esquema ya está sincronizado.
 *
 * La lista de índices no se duplica: se lee del propio archivo de migración,
 * que es el origen único. Se resuelve desde la raíz del proyecto porque
 * `database/migrations/` no se compila a `dist/`.
 */
export default async (strapi: Core.Strapi): Promise<void> => {
  const migrationPath = path.join(
    strapi.dirs.app.root,
    'database',
    'migrations',
    '2026.09.26T00.00.00.business-indexes.js'
  );

  const { createIndexes } = require(migrationPath);
  const created: string[] = await createIndexes(strapi.db.connection);

  if (created.length > 0) {
    strapi.log.info(`[indexes] ${created.length} índices de negocio verificados`);
  }
};
