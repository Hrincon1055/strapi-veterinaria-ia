'use strict';

/**
 * Genera el PDF de una factura desde la terminal.
 *
 *   node factura-pdf.js FE129                 por número de factura
 *   node factura-pdf.js <documentId> [salida]  por documentId (sirve para borradores)
 *
 * Usa el mismo servicio que el panel (`api::billing.invoice-pdf`). Por defecto
 * escribe en `.tmp/facturas/`, que está en .gitignore: la factura lleva datos
 * personales y no debe acabar en el repositorio.
 */

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const clave = process.argv[2];
if (!clave) {
  console.error('Uso: node factura-pdf.js <número de factura | documentId> [archivo de salida]');
  process.exit(1);
}

(async () => {
  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();
  app.log.level = 'error';

  try {
    const factura =
      (await app.documents('api::billing.invoice').findFirst({ filters: { fullNumber: clave, archivedAt: { $null: true } } })) ??
      (await app.documents('api::billing.invoice').findFirst({ filters: { documentId: clave, archivedAt: { $null: true } } }));
    if (!factura) {
      console.error(`No hay ninguna factura con número o documentId "${clave}"`);
      process.exitCode = 1;
      return;
    }

    const { pdf, nombreArchivo } = await app.service('api::billing.invoice-pdf').generar(factura.documentId);
    const salida = process.argv[3] ?? path.join('.tmp', 'facturas', nombreArchivo);
    fs.mkdirSync(path.dirname(salida), { recursive: true });
    fs.writeFileSync(salida, pdf);
    console.log(`${salida} (${Math.round(pdf.length / 1024)} KB)`);
  } finally {
    await app.destroy();
  }
})().catch((e) => {
  console.error('no se pudo generar el PDF:', e.message);
  process.exit(2);
});
