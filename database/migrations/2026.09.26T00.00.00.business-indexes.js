'use strict';

/**
 * Índices de negocio. Origen único de la verdad: esta lista la consume tanto
 * la migración como `src/bootstrap/indexes.ts`.
 *
 * Los índices parciales (`WHERE ...`) se comportan igual en PostgreSQL y en
 * SQLite, así que el mismo SQL sirve para el desarrollo local en SQLite y para
 * PostgreSQL en despliegue. MySQL no los admite: si algún día se usa MySQL,
 * estas reglas quedan cubiertas por los middlewares de src/validations/.
 *
 * Las reglas que combinan una relación con otro campo no aparecen aquí: en
 * Strapi 5 las relaciones viven en tablas de enlace (`*_lnk`) y no se pueden
 * expresar como índice.
 */

const INDEXES = [
  {
    name: 'ux_profiles_document',
    table: 'profiles',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_document
            ON profiles (document_type, document_number) WHERE archived_at IS NULL`,
  },
  {
    name: 'ux_pets_microchip',
    table: 'pets',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_pets_microchip
            ON pets (microchip) WHERE microchip IS NOT NULL AND archived_at IS NULL`,
  },
  {
    name: 'ux_invoices_dataico',
    table: 'invoices',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_dataico
            ON invoices (dataico_invoice_id) WHERE dataico_invoice_id IS NOT NULL`,
  },
  // Facturación: que un concepto de consulta no se cobre dos veces. Un renglón
  // lleva `lock_key` (= lineKey de la línea) mientras su factura no esté
  // anulada; anular lo pone a NULL. Cubre la carrera que la validación no
  // puede: dos personas creando a la vez borradores con la misma línea.
  {
    name: 'ux_invoice_items_lock',
    table: 'invoice_items',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_items_lock
            ON invoice_items (lock_key) WHERE lock_key IS NOT NULL`,
  },
  // El consecutivo completo (prefijo + número) no se repite nunca, aunque el
  // incremento atómico de la emisión fallara.
  {
    name: 'ux_invoices_full_number',
    table: 'invoices',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_full_number
            ON invoices (full_number) WHERE full_number IS NOT NULL`,
  },
  {
    name: 'idx_invoices_issued_at',
    table: 'invoices',
    sql: `CREATE INDEX IF NOT EXISTS idx_invoices_issued_at
            ON invoices (issued_at, state)`,
  },
  {
    name: 'ux_notifications_dedupe',
    table: 'notifications',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_dedupe
            ON notifications (dedupe_key) WHERE dedupe_key IS NOT NULL`,
  },
  {
    name: 'ux_deliveries_idempotency',
    table: 'notification_deliveries',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_deliveries_idempotency
            ON notification_deliveries (idempotency_key)`,
  },
  {
    name: 'idx_deliveries_queue',
    table: 'notification_deliveries',
    sql: `CREATE INDEX IF NOT EXISTS idx_deliveries_queue
            ON notification_deliveries (state, next_attempt_at)`,
  },
  {
    name: 'idx_deliveries_lock',
    table: 'notification_deliveries',
    sql: `CREATE INDEX IF NOT EXISTS idx_deliveries_lock
            ON notification_deliveries (locked_by, lock_expires_at)`,
  },
  {
    name: 'idx_appointments_start',
    table: 'appointments',
    sql: `CREATE INDEX IF NOT EXISTS idx_appointments_start
            ON appointments (start_at, state)`,
  },
  {
    name: 'idx_signed_documents_state_expiry',
    table: 'signed_documents',
    sql: `CREATE INDEX IF NOT EXISTS idx_signed_documents_state_expiry
            ON signed_documents (state, expires_at)`,
  },
  {
    name: 'idx_notifications_event',
    table: 'notifications',
    sql: `CREATE INDEX IF NOT EXISTS idx_notifications_event
            ON notifications (event_type, created_at)`,
  },
];

/**
 * Crea los índices cuya tabla ya exista. Devuelve los nombres creados.
 *
 * Strapi ejecuta las migraciones de usuario dentro de `schema.sync`, es decir
 * ANTES de crear las tablas de los content types. En una base de datos nueva
 * las tablas todavía no están, así que aquí se omiten sin fallar y es
 * `src/bootstrap/indexes.ts` quien las crea una vez existen. En una base ya
 * poblada esta migración hace el trabajo directamente.
 */
async function createIndexes(knex) {
  const created = [];

  for (const index of INDEXES) {
    if (!(await knex.schema.hasTable(index.table))) continue;
    await knex.raw(index.sql);
    created.push(index.name);
  }

  return created;
}

module.exports = {
  INDEXES,
  createIndexes,

  async up(knex) {
    await createIndexes(knex);
  },

  async down(knex) {
    for (const index of INDEXES) {
      await knex.raw(`DROP INDEX IF EXISTS ${index.name}`);
    }
  },
};
