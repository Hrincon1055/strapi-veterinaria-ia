'use strict';

/**
 * Migra las consultas de los tres campos sueltos a la dynamic zone `sections`.
 *
 *   node migrate-consultation-sections.js --dry    muestra qué haría
 *   node migrate-consultation-sections.js          lo aplica
 *
 * Se ejecuta ANTES de quitar `anamnesis`, `diagnosis` y `treatmentNotes` del
 * esquema: una vez quitados, Strapi deja de exponerlos y el contenido ya no se
 * puede leer desde el Document Service. Por eso la migración va en dos fases y
 * no en una.
 *
 * Correspondencia:
 *   anamnesis      -> clinical.anamnesis.history
 *   diagnosis      -> clinical.diagnosis (condition + details)
 *   treatmentNotes -> clinical.treatment-plan.indications
 *
 * Es idempotente: una consulta que ya tenga secciones no se vuelve a tocar.
 */

const { createStrapi } = require('@strapi/strapi');

const SECO = process.argv.includes('--dry');

/** Texto plano de un campo `blocks`, párrafo a párrafo. */
const parrafosDe = (bloques) =>
  !Array.isArray(bloques)
    ? []
    : bloques.map((b) => (b.children ?? []).map((c) => c.text ?? '').join('')).filter(Boolean);

const tieneContenido = (bloques) => parrafosDe(bloques).length > 0;

/**
 * `diagnosis` era texto libre pero `condition` es un título corto y
 * obligatorio. Se toma la primera frase del primer párrafo —que es como
 * escriben los veterinarios, el diagnóstico primero— y el texto completo se
 * conserva íntegro en `details`, así que no se pierde nada.
 */
function tituloDiagnostico(bloques) {
  const primero = parrafosDe(bloques)[0] ?? '';
  const frase = primero.split(/(?<=[.:])\s/)[0] ?? primero;
  const limpio = frase.replace(/[.:]\s*$/, '').trim();
  return (limpio || 'Diagnóstico').slice(0, 200);
}

(async () => {
  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();
  const d = app.documents('api::clinical.consultation');

  const consultas = await d.findMany({
    filters: { $or: [{ archivedAt: { $null: true } }, { archivedAt: { $null: false } }] },
    populate: ['sections', 'pet'],
  });

  console.log(`\n${consultas.length} consultas encontradas${SECO ? '  (simulación)' : ''}\n`);

  let migradas = 0;
  let saltadas = 0;

  for (const c of consultas) {
    if (Array.isArray(c.sections) && c.sections.length > 0) {
      saltadas++;
      continue;
    }

    const sections = [];

    if (tieneContenido(c.anamnesis)) {
      sections.push({ __component: 'clinical.anamnesis', history: c.anamnesis, reportedBy: 'owner' });
    }

    if (tieneContenido(c.diagnosis)) {
      sections.push({
        __component: 'clinical.diagnosis',
        diagnosisKind: 'definitive',
        condition: tituloDiagnostico(c.diagnosis),
        isPrimary: true,
        details: c.diagnosis,
      });
    }

    if (tieneContenido(c.treatmentNotes)) {
      sections.push({
        __component: 'clinical.treatment-plan',
        indications: c.treatmentNotes,
        ...(c.nextControlOn ? { followUpOn: c.nextControlOn } : {}),
      });
    }

    if (sections.length === 0) {
      saltadas++;
      continue;
    }

    const etiqueta = `${String(c.consultedAt).slice(0, 10)} ${c.pet?.name ?? ''}`.trim();
    console.log(`  ${etiqueta.padEnd(24)} -> ${sections.map((s) => s.__component.replace('clinical.', '')).join(', ')}`);
    if (sections.some((s) => s.__component === 'clinical.diagnosis')) {
      console.log(`  ${''.padEnd(24)}    condition: "${sections.find((s) => s.__component === 'clinical.diagnosis').condition}"`);
    }

    if (!SECO) {
      await d.update({ documentId: c.documentId, data: { sections } });
    }
    migradas++;
  }

  console.log(`\n${migradas} migradas, ${saltadas} sin cambios${SECO ? '  (no se escribió nada)' : ''}\n`);

  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error('la migración falló:', e);
  process.exit(1);
});
