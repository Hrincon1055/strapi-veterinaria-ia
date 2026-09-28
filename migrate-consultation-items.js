'use strict';

/**
 * Migra las líneas de servicio de la consulta (`services`, componente
 * `scheduling.consultation-service`) al componente general `items`
 * (`clinical.consultation-item`), que admite servicio O producto.
 *
 *   node migrate-consultation-items.js --dry    muestra qué haría
 *   node migrate-consultation-items.js          lo aplica
 *
 * Se ejecuta con los DOS campos en el esquema, antes de quitar `services`: una
 * vez quitado, Strapi deja de exponerlo y el contenido ya no se puede leer
 * desde el Document Service. Por eso va en dos fases, como la de `sections`.
 *
 * Correspondencia: service -> service, quantity -> quantity, notes -> notes,
 * y state = 'applied' (lo que había eran servicios ya prestados).
 *
 * Es idempotente: una consulta que ya tenga `items` no se vuelve a tocar.
 */

const { createStrapi } = require('@strapi/strapi');

const SECO = process.argv.includes('--dry');

(async () => {
  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();
  const d = app.documents('api::clinical.consultation');

  const consultas = await d.findMany({
    filters: { $or: [{ archivedAt: { $null: true } }, { archivedAt: { $null: false } }] },
    populate: { services: { populate: ['service'] }, items: true, pet: true },
  });

  console.log(`\n${consultas.length} consultas encontradas${SECO ? '  (simulación)' : ''}\n`);

  let migradas = 0;
  let saltadas = 0;
  let lineas = 0;

  for (const c of consultas) {
    const viejas = c.services ?? [];
    if (viejas.length === 0 || (c.items ?? []).length > 0) {
      saltadas++;
      continue;
    }

    const items = viejas
      .filter((l) => l.service?.documentId)
      .map((l) => ({
        service: l.service.documentId,
        quantity: l.quantity ?? 1,
        state: 'applied',
        ...(l.notes ? { notes: l.notes } : {}),
      }));

    console.log(`  ${c.pet?.name ?? '—'}  ${String(c.consultedAt).slice(0, 10)}  ${items.length} líneas`);
    lineas += items.length;
    migradas++;

    if (!SECO) {
      await d.update({ documentId: c.documentId, data: { items } });
    }
  }

  console.log(`\n${migradas} consultas migradas (${lineas} líneas), ${saltadas} sin cambios${SECO ? ' — simulación, no se escribió nada' : ''}\n`);

  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error('la migración falló:', e.message);
  process.exit(1);
});
