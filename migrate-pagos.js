'use strict';

/**
 * Migración al módulo de caja (sección 5.7): las facturas que se marcaron
 * pagadas a mano antes de existir los pagos.
 *
 *   node migrate-pagos.js --dry   cuenta lo que haría, sin escribir
 *   node migrate-pagos.js         lo hace
 *
 * Por cada factura emitida con `paymentState = paid` y sin pagos, crea un pago
 * por el total con el medio `other` (sin turno: el dinero ya entró antes de
 * que hubiera caja). Así `paidAmount` cuadra y el estado se sigue calculando
 * igual que para todas. Las `partial` no se tocan: no se sabe cuánto se pagó;
 * se listan para registrarlas a mano en la caja.
 *
 * Idempotente: una factura que ya tiene pagos no se toca. Para `npm run
 * develop` antes de ejecutarla (arranca su propia instancia contra `dist/`).
 */

const { createStrapi } = require('@strapi/strapi');

const NOTA = 'Pago registrado antes del módulo de caja (migrate-pagos.js)';

(async () => {
  const seco = process.argv.includes('--dry');
  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();

  const facturas = await app.db.query('api::billing.invoice').findMany({
    where: { state: { $in: ['issued', 'dian_error'] }, paymentState: { $in: ['paid', 'partial'] } },
    select: ['id', 'documentId', 'fullNumber', 'amount', 'paymentState', 'paidAmount', 'issuedAt'],
    populate: { customer: { select: ['documentId'] } },
  });

  let creados = 0;
  const parciales = [];
  for (const f of facturas) {
    const pagos = await app.db.query('api::cash.payment').count({ where: { invoice: { id: f.id } } });
    if (pagos > 0) continue;
    if (f.paymentState === 'partial') {
      parciales.push(f.fullNumber);
      continue;
    }
    if (!f.customer?.documentId) {
      console.log(`  ${f.fullNumber}: sin cliente, se omite`);
      continue;
    }
    console.log(`  ${f.fullNumber}: pago "other" por $ ${Number(f.amount).toLocaleString('es-CO')}`);
    if (!seco) {
      await app.documents('api::cash.payment').create({
        data: {
          kind: 'payment', purpose: 'invoice', method: 'other', amount: Number(f.amount),
          invoice: f.documentId, customer: f.customer.documentId, paidAt: f.issuedAt ?? new Date().toISOString(), notes: NOTA,
        },
      });
    }
    creados++;
  }

  console.log(`\n${seco ? '[simulación] ' : ''}${creados} pagos ${seco ? 'por crear' : 'creados'}`);
  if (parciales.length > 0) console.log(`Con pago parcial, para registrar a mano en la caja: ${parciales.join(', ')}`);
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error('la migración falló:', e);
  process.exit(1);
});
