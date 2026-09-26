'use strict';

/**
 * Convierte `api::scheduling.consultation-service` (content type) en el
 * componente repetible `scheduling.consultation-service`.
 *
 *   node migrate-consultation-services.js --export   antes de cambiar el esquema
 *   node migrate-consultation-services.js --import   después de cambiarlo
 *
 * Va en dos pasos con un archivo intermedio, y no en uno solo, porque el campo
 * tiene que seguir llamándose `services`: no se puede tener a la vez la
 * relación y el componente con ese nombre, y renombrar pierde el contenido.
 * Exportar primero deja los datos fuera del esquema mientras se cambia.
 *
 * El archivo intermedio es temporal; bórralo cuando la migración esté hecha.
 */

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const ARCHIVO = path.join(process.cwd(), '.tmp', 'consultation-services.json');

async function exportar(app) {
  const filas = await app.documents('api::scheduling.consultation-service').findMany({
    populate: ['consultation', 'service', 'performedBy'],
  });

  const porConsulta = {};
  for (const f of filas) {
    const padre = f.consultation?.documentId;
    if (!padre) {
      console.log(`  AVISO: línea ${f.documentId} sin consulta, se descarta`);
      continue;
    }
    (porConsulta[padre] ??= []).push({
      service: f.service?.documentId ?? null,
      quantity: f.quantity,
      durationMinutes: f.durationMinutes,
      unitPrice: f.unitPrice,
      totalPrice: f.totalPrice,
      performedBy: f.performedBy?.documentId ?? null,
      notes: f.notes ?? null,
    });
  }

  fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });
  fs.writeFileSync(ARCHIVO, JSON.stringify(porConsulta, null, 2));

  const total = Object.values(porConsulta).reduce((n, l) => n + l.length, 0);
  console.log(`\n  ${total} líneas de ${Object.keys(porConsulta).length} consultas exportadas`);
  console.log(`  -> ${ARCHIVO}\n`);
  console.log('  Ahora cambia el esquema y ejecuta con --import.\n');
}

async function importar(app) {
  if (!fs.existsSync(ARCHIVO)) {
    throw new Error(`No existe ${ARCHIVO}; ejecuta antes con --export`);
  }

  const porConsulta = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));
  let consultas = 0;
  let lineas = 0;

  for (const [documentId, servicios] of Object.entries(porConsulta)) {
    const actual = await app.documents('api::clinical.consultation').findOne({
      documentId,
      populate: ['services'],
    });

    if (!actual) {
      console.log(`  AVISO: la consulta ${documentId} ya no existe, se salta`);
      continue;
    }
    if (Array.isArray(actual.services) && actual.services.length > 0) {
      continue; // ya migrada
    }

    await app.documents('api::clinical.consultation').update({
      documentId,
      data: { services: servicios },
    });

    consultas++;
    lineas += servicios.length;
  }

  console.log(`\n  ${lineas} líneas restauradas en ${consultas} consultas\n`);
}

(async () => {
  const modo = process.argv.includes('--import')
    ? 'import'
    : process.argv.includes('--export')
      ? 'export'
      : null;

  if (!modo) {
    console.error('Usa --export o --import');
    process.exit(1);
  }

  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();
  await (modo === 'export' ? exportar(app) : importar(app));
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error('la migración falló:', e.message);
  process.exit(1);
});
