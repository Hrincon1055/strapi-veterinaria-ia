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

/** Título legible de cada componente de la dynamic zone. */
const TITULOS = {
  'clinical.anamnesis': 'Anamnesis',
  'clinical.physical-exam': 'Exploración física',
  'clinical.lab-result': 'Laboratorio',
  'clinical.imaging': 'Imagen diagnóstica',
  'clinical.diagnosis': 'Diagnóstico',
  'clinical.procedure': 'Procedimiento',
  'clinical.treatment-plan': 'Plan de tratamiento',
};

/** Campos `blocks` que hay que volcar como párrafos, por componente. */
const BLOQUES = {
  'clinical.anamnesis': ['history'],
  'clinical.physical-exam': ['findings'],
  'clinical.lab-result': ['findings'],
  'clinical.imaging': ['findings'],
  'clinical.diagnosis': ['details'],
  'clinical.procedure': ['findings'],
  'clinical.treatment-plan': ['indications', 'recommendations'],
};

/** Los datos estructurados de cada sección, antes de su texto libre. */
function resumenSeccion(s) {
  const l = [];
  switch (s.__component) {
    case 'clinical.anamnesis':
      if (s.evolutionDays != null) l.push(`Evolución: ${s.evolutionDays} día(s) · refiere: ${s.reportedBy}`);
      break;
    case 'clinical.physical-exam': {
      const v = [
        s.temperatureC != null && `T ${s.temperatureC} °C`,
        s.heartRateBpm != null && `FC ${s.heartRateBpm} lpm`,
        s.respiratoryRateRpm != null && `FR ${s.respiratoryRateRpm} rpm`,
        s.mucousMembranes && `mucosas ${s.mucousMembranes}`,
        s.capillaryRefillSeconds != null && `TRC ${s.capillaryRefillSeconds}s`,
        s.bodyConditionScore != null && `CC ${s.bodyConditionScore}/9`,
        s.hydrationState && `hidratación ${s.hydrationState}`,
      ].filter(Boolean);
      if (v.length) l.push(v.join(' · '));
      break;
    }
    case 'clinical.lab-result':
      l.push(`${s.panel}${s.laboratory ? ' · ' + s.laboratory : ''}${s.isAbnormal ? ' · ALTERADO' : ''}`);
      break;
    case 'clinical.imaging':
      l.push(`${s.modality}${s.bodyRegion ? ' · ' + s.bodyRegion : ''}`);
      break;
    case 'clinical.diagnosis':
      l.push(`${s.condition}  [${s.diagnosisKind}${s.isPrimary ? ' · principal' : ''}]`);
      break;
    case 'clinical.procedure':
      l.push(`${s.procedureName} · anestesia ${s.anesthesia}${s.durationMinutes ? ' · ' + s.durationMinutes + ' min' : ''}`);
      if (s.complications) l.push(`Complicaciones: ${s.complications}`);
      break;
    case 'clinical.treatment-plan':
      for (const m of s.medications ?? []) {
        const pauta = [m.dose, m.route, m.frequencyHours && `c/${m.frequencyHours}h`, m.durationDays && `${m.durationDays} días`]
          .filter(Boolean)
          .join(' · ');
        l.push(`Rx  ${m.drug}${pauta ? ' — ' + pauta : ''}${m.notes ? ' (' + m.notes + ')' : ''}`);
      }
      if (s.followUpOn) l.push(`Control: ${fecha(s.followUpOn)}`);
      break;
  }
  return l;
}

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
    // La zona hay que enumerarla componente a componente: no la alcanza un '*'.
    populate: {
      vet: true,
      appointment: { populate: ['room'] },
      services: { populate: ['service'] },
      sections: {
        on: {
          'clinical.anamnesis': true,
          'clinical.physical-exam': true,
          'clinical.diagnosis': true,
          'clinical.procedure': true,
          'clinical.lab-result': { populate: ['report'] },
          'clinical.imaging': { populate: ['images'] },
          'clinical.treatment-plan': { populate: ['medications'] },
        },
      },
    },
    sort: 'consultedAt:desc',
  });

  console.log(seccion(`  CONSULTAS  (${consultas.length})`));

  let granTotal = 0;

  for (const c of consultas) {
    // Ya no hay que pedirlas aparte: vienen en el populate de la consulta.
    const servicios = c.services ?? [];

    const total = servicios.reduce((s, x) => s + (x.totalPrice ?? 0), 0);
    granTotal += total;

    console.log(`\n  ${fecha(c.consultedAt)}  ·  ${c.appointment?.title ?? c.reason ?? 'Consulta'}`);
    console.log(`  ${'-'.repeat(72)}`);
    console.log(`    Motivo      ${c.reason ?? '—'}`);
    console.log(`    Atendió     ${c.vet?.email ?? '—'}`);
    console.log(`    Lugar       ${c.appointment?.room?.name ?? '—'}`);
    console.log(`    Peso        ${c.weightKg ?? '—'} kg`);
    if (c.nextControlOn) console.log(`    Control     ${fecha(c.nextControlOn)}`);

    // La historia ya no son tres campos fijos: se recorre la dynamic zone en
    // el orden en que el veterinario compuso la consulta.
    for (const s of c.sections ?? []) {
      const tipo = TITULOS[s.__component] ?? s.__component.replace('clinical.', '');
      console.log(`\n    ${tipo}`);
      for (const linea of resumenSeccion(s)) console.log('      ' + linea);
      for (const campo of BLOQUES[s.__component] ?? []) {
        for (const p of texto(s[campo])) console.log(envolver(p, 66, '      '));
      }
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
