'use strict';

/**
 * Imprime la historia clínica completa de una mascota.
 *
 *   node demo-historia.js Kira
 *
 * Reúne lo que el modelo tiene repartido: la ficha de la mascota, sus alergias
 * activas, el carné de vacunas y la línea de tiempo de consultas con los
 * servicios de cada una. No existe un content type `medical-history`: la
 * historia ES esta consulta, y por eso todo cuelga directamente de la mascota.
 */

const { createStrapi } = require('@strapi/strapi');

const NOMBRE = process.argv[2] ?? 'Kira';

const COP = (n) =>
  n == null ? '—' : '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });

const fecha = (v) => (v ? String(v).slice(0, 10) : '—');

/** Extrae el texto plano de un campo `blocks`. */
const texto = (bloques) =>
  !Array.isArray(bloques)
    ? []
    : bloques.map((b) => (b.children ?? []).map((c) => c.text ?? '').join('')).filter(Boolean);

/** Envuelve un párrafo largo respetando palabras. */
function envolver(t, ancho, sangria) {
  const palabras = t.split(' ');
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    if ((actual + ' ' + p).trim().length > ancho) {
      lineas.push(actual.trim());
      actual = p;
    } else {
      actual += ' ' + p;
    }
  }
  if (actual.trim()) lineas.push(actual.trim());
  return lineas.map((l) => sangria + l).join('\n');
}

const seccion = (titulo) => `\n${titulo}\n${'─'.repeat(74)}`;

(async () => {
  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();
  const d = (uid) => app.documents(uid);

  const mascota = await d('api::pet.pet').findFirst({
    filters: { name: NOMBRE },
    populate: { species: true, breed: true, owner: { populate: ['profile'] } },
  });

  if (!mascota) {
    console.error(`No existe la mascota "${NOMBRE}".`);
    await app.destroy();
    process.exit(1);
  }

  const duenio = mascota.owner?.profile;
  const edad = mascota.birthDate
    ? ((Date.now() - new Date(mascota.birthDate)) / 31557600000).toFixed(1) + ' años'
    : '—';

  console.log('\n' + '═'.repeat(74));
  console.log(`  HISTORIA CLÍNICA — ${mascota.name}`);
  console.log('═'.repeat(74));
  console.log(`  Especie / raza  ${mascota.species?.name ?? '—'} · ${mascota.breed?.name ?? '—'}`);
  console.log(`  Sexo / edad     ${mascota.sex} · ${edad} (nac. ${fecha(mascota.birthDate)})`);
  console.log(`  Peso actual     ${mascota.weightKg} kg`);
  console.log(`  Esterilización  ${mascota.sterilizationState}${mascota.sterilizedOn ? ' (' + fecha(mascota.sterilizedOn) + ')' : ''}`);
  console.log(`  Microchip       ${mascota.microchip ?? '—'}`);
  console.log(`  Propietario     ${duenio ? duenio.firstName + ' ' + duenio.lastName + ' · ' + String(duenio.documentType).toUpperCase() + ' ' + duenio.documentNumber : '—'}`);

  // --- alergias: lo primero que un veterinario necesita ver ---
  const alergias = await d('api::clinical.allergy').findMany({
    filters: { pet: { documentId: mascota.documentId } },
  });

  if (alergias.length > 0) {
    console.log(seccion('  ⚠  ALERGIAS'));
    for (const a of alergias) {
      const estado = a.isActive ? 'activa' : `resuelta ${fecha(a.resolvedOn)}`;
      console.log(`  ${a.allergen}  [${a.severity} · ${a.category} · ${estado}]`);
      if (a.reaction) console.log(envolver(a.reaction, 68, '      '));
      if (a.notes) console.log(envolver(a.notes, 68, '      '));
    }
  }

  // --- carné de vacunas ---
  const vacunas = await d('api::clinical.pet-vaccination').findMany({
    filters: { pet: { documentId: mascota.documentId } },
    populate: ['vaccine'],
    sort: 'appliedOn:desc',
  });

  if (vacunas.length > 0) {
    console.log(seccion('  CARNÉ DE VACUNAS'));
    console.log('  Aplicada     Vacuna                         Dosis  Lote           Próxima');
    for (const v of vacunas) {
      const vencida = v.nextDueOn && v.nextDueOn < new Date().toISOString().slice(0, 10);
      console.log(
        `  ${fecha(v.appliedOn)}   ${(v.vaccine?.name ?? '—').padEnd(30)} ${String(v.doseNumber ?? '—').padEnd(6)} ${(v.batchNumber ?? '—').padEnd(14)} ${fecha(v.nextDueOn)}${vencida ? '  ← vencida' : ''}`
      );
    }
  }

  // --- línea de tiempo de consultas ---
  const consultas = await d('api::clinical.consultation').findMany({
    filters: { pet: { documentId: mascota.documentId } },
    populate: { vet: true, appointment: { populate: ['room'] } },
    sort: 'consultedAt:desc',
  });

  console.log(seccion(`  CONSULTAS  (${consultas.length})`));

  let granTotal = 0;

  for (const c of consultas) {
    const servicios = await d('api::scheduling.consultation-service').findMany({
      filters: { consultation: { documentId: c.documentId } },
      populate: ['service'],
    });

    const total = servicios.reduce((s, x) => s + (x.totalPrice ?? 0), 0);
    granTotal += total;

    console.log(`\n  ${fecha(c.consultedAt)}  ·  ${c.appointment?.title ?? c.reason ?? 'Consulta'}`);
    console.log(`  ${'-'.repeat(72)}`);
    console.log(`    Motivo      ${c.reason ?? '—'}`);
    console.log(`    Atendió     ${c.vet?.email ?? '—'}`);
    console.log(`    Lugar       ${c.appointment?.room?.name ?? '—'}`);
    console.log(`    Peso        ${c.weightKg ?? '—'} kg`);
    if (c.nextControlOn) console.log(`    Control     ${fecha(c.nextControlOn)}`);

    for (const [titulo, campo] of [
      ['Anamnesis', c.anamnesis],
      ['Diagnóstico', c.diagnosis],
      ['Tratamiento', c.treatmentNotes],
    ]) {
      const parrafos = texto(campo);
      if (parrafos.length === 0) continue;
      console.log(`\n    ${titulo}`);
      for (const p of parrafos) console.log(envolver(p, 66, '      '));
    }

    if (servicios.length > 0) {
      console.log(`\n    Servicios`);
      for (const s of servicios) {
        const linea = `      ${(s.service?.name ?? '—').padEnd(34)} ×${String(s.quantity).padEnd(3)} ${COP(s.unitPrice).padStart(12)} ${COP(s.totalPrice).padStart(12)}`;
        console.log(linea);
      }
      console.log(`      ${''.padEnd(34)} ${''.padEnd(4)} ${'total'.padStart(12)} ${COP(total).padStart(12)}`);
    }
  }

  console.log('\n' + '═'.repeat(74));
  console.log(`  Facturado en ${consultas.length} consultas: ${COP(granTotal)}`);
  console.log('═'.repeat(74) + '\n');

  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error('no se pudo leer la historia:', e.message);
  process.exit(1);
});
