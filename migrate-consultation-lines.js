'use strict';

/**
 * Migra los servicios y productos de la consulta del componente repetible
 * `items` (`clinical.consultation-item`, con dos selectores por línea) a la
 * dynamic zone `lines`, con una tarjeta por tipo: `clinical.service-line` y
 * `clinical.product-line`.
 *
 *   node migrate-consultation-lines.js --dry    muestra qué haría
 *   node migrate-consultation-lines.js          lo aplica
 *
 * Se ejecuta con los DOS campos en el esquema, antes de quitar `items`: una
 * vez quitado, Strapi deja de exponerlo y el contenido ya no se puede leer
 * desde el Document Service. Por eso va en dos fases, como la de `sections`.
 *
 * Una línea con servicio pasa a tarjeta Servicio; con producto, a tarjeta
 * Producto. Cantidad, estado y notas se copian tal cual; `label` lo pone el
 * middleware de la consulta. Una línea de servicio marcada `dispensed` (no
 * debería existir: la regla lo impedía) pasaría a `applied`, y se avisa.
 *
 * Es idempotente: una consulta que ya tenga `lines` no se vuelve a tocar.
 */

const { createStrapi } = require('@strapi/strapi');

const SECO = process.argv.includes('--dry');

(async () => {
  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();
  const d = app.documents('api::clinical.consultation');

  const consultas = await d.findMany({
    filters: { $or: [{ archivedAt: { $null: true } }, { archivedAt: { $null: false } }] },
    populate: {
      items: { populate: ['service', 'product'] },
      lines: { on: { 'clinical.service-line': true, 'clinical.product-line': true } },
      pet: true,
    },
  });

  console.log(`\n${consultas.length} consultas encontradas${SECO ? '  (simulación)' : ''}\n`);

  let migradas = 0;
  let saltadas = 0;
  let lineas = 0;

  for (const c of consultas) {
    const viejas = c.items ?? [];
    if (viejas.length === 0 || (c.lines ?? []).length > 0) {
      saltadas++;
      continue;
    }

    const lines = [];
    for (const l of viejas) {
      const comun = {
        quantity: Number(l.quantity ?? 1),
        ...(l.notes ? { notes: l.notes } : {}),
      };
      if (l.service?.documentId) {
        if (l.state === 'dispensed') {
          console.log(`    aviso: servicio "${l.service.name}" marcado como entregado; pasa a aplicado`);
        }
        lines.push({
          __component: 'clinical.service-line',
          service: l.service.documentId,
          state: l.state === 'recommended' ? 'recommended' : 'applied',
          ...comun,
        });
      } else if (l.product?.documentId) {
        lines.push({ __component: 'clinical.product-line', product: l.product.documentId, state: l.state ?? 'applied', ...comun });
      }
    }

    console.log(`  ${c.pet?.name ?? '—'}  ${String(c.consultedAt).slice(0, 10)}  ${lines.length} líneas`);
    lineas += lines.length;
    migradas++;

    if (!SECO) {
      await d.update({ documentId: c.documentId, data: { lines } });
    }
  }

  console.log(`\n${migradas} consultas migradas (${lineas} líneas), ${saltadas} sin cambios${SECO ? ' — simulación, no se escribió nada' : ''}\n`);

  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error('la migración falló:', e.message);
  process.exit(1);
});
