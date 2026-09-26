'use strict';

/**
 * Historia clínica de muestra: dos años de eventos sobre una mascota, con los
 * tres tipos que interesan — vacunación, estética (corte de pelo) y cirugía.
 *
 * Lo usa `demo-data.js`; no se ejecuta suelto. Para ver el resultado:
 *   node demo-historia.js Kira
 *
 * Cada visita se modela igual que en la vida real: una cita (`appointment`)
 * que se completó, y la consulta (`consultation`) que quedó de ella con los
 * servicios prestados. La vacunación añade además el registro `pet-vaccination`,
 * que es lo que alimenta el carné de vacunas y los recordatorios.
 */

const MASCOTA = 'Kira';

/** Bloque de texto enriquecido en el formato que espera el tipo `blocks`. */
const parrafos = (...textos) =>
  textos.map((texto) => ({ type: 'paragraph', children: [{ type: 'text', text: texto }] }));

// --- catálogo que hace falta para poder registrar los eventos --------------

const CONSULTORIOS = [
  { name: 'Consultorio 1', roomType: 'consultation' },
  { name: 'Quirófano', roomType: 'surgery' },
  { name: 'Sala de estética', roomType: 'grooming' },
];

const SERVICIOS = [
  { categoria: 'Consulta', name: 'Consulta general', defaultDurationMinutes: 30, basePrice: 60000 },
  { categoria: 'Consulta', name: 'Control posquirúrgico', defaultDurationMinutes: 20, basePrice: 40000 },
  { categoria: 'Vacunación', name: 'Aplicación de vacuna', defaultDurationMinutes: 15, basePrice: 45000 },
  { categoria: 'Estética', name: 'Baño y corte de pelo', defaultDurationMinutes: 90, basePrice: 75000 },
  { categoria: 'Cirugía', name: 'Cirugía de tejidos blandos', defaultDurationMinutes: 150, basePrice: 850000 },
  { categoria: 'Cirugía', name: 'Anestesia general', defaultDurationMinutes: 150, basePrice: 220000 },
  { categoria: 'Laboratorio', name: 'Hemograma completo', defaultDurationMinutes: 10, basePrice: 90000 },
  { categoria: 'Imagenología', name: 'Radiografía abdominal', defaultDurationMinutes: 20, basePrice: 120000 },
];

const VACUNAS = [
  { name: 'Rabia', especie: 'Perro', manufacturer: 'Zoetis', isMandatory: true },
  { name: 'Polivalente DHPPi+L', especie: 'Perro', manufacturer: 'MSD Animal Health', isMandatory: true },
  { name: 'Tos de las perreras (Bordetella)', especie: 'Perro', manufacturer: 'Zoetis', isMandatory: false },
];

const VETERINARIO = {
  username: 'laura.gomez',
  email: 'laura.gomez@veterinaria.test',
  password: 'Clinica12345',
  perfil: {
    firstName: 'Laura',
    lastName: 'Gómez',
    documentType: 'cc',
    documentNumber: '43118902',
    occupation: 'Médica veterinaria',
    gender: 'female',
  },
};

// --- la historia -----------------------------------------------------------

/**
 * Cada entrada es una visita. `servicios` son los que se cobraron y
 * `vacunas` las dosis aplicadas, si las hubo.
 */
const VISITAS = [
  {
    etiqueta: 'Vacunación anual',
    consultorio: 'Consultorio 1',
    inicio: '2024-04-18T15:00:00.000Z',
    fin: '2024-04-18T15:45:00.000Z',
    reason: 'Vacunación anual y revisión general',
    anamnesis: parrafos(
      'Paciente que acude para refuerzo anual. La propietaria la reporta activa, con apetito normal y sin cambios en el comportamiento.',
      'Desparasitación interna al día (última dosis hace dos meses). Convive con un gato en apartamento y sale a caminar a diario.'
    ),
    diagnosis: parrafos(
      'Paciente clínicamente sana. Constantes dentro de rango, mucosas rosadas, ganglios no reactivos, auscultación cardiopulmonar sin hallazgos.'
    ),
    treatmentNotes: parrafos(
      'Se aplican refuerzos de rabia y polivalente. Próximo refuerzo en doce meses.',
      'Se recomienda control de peso: ha subido 600 g desde la última visita.'
    ),
    weightKg: 26.8,
    servicios: [
      { nombre: 'Consulta general', cantidad: 1 },
      { nombre: 'Aplicación de vacuna', cantidad: 2 },
    ],
    vacunas: [
      { nombre: 'Rabia', dosis: 3, lote: 'RB-2024-0417', vence: '2025-08-31', proxima: '2025-04-18' },
      { nombre: 'Polivalente DHPPi+L', dosis: 3, lote: 'PV-2024-1120', vence: '2025-10-31', proxima: '2025-04-18' },
    ],
  },
  {
    etiqueta: 'Corte de pelo',
    consultorio: 'Sala de estética',
    inicio: '2025-01-22T14:00:00.000Z',
    fin: '2025-01-22T15:30:00.000Z',
    reason: 'Baño y corte de pelo',
    anamnesis: parrafos(
      'Cita de estética. La propietaria pide corte de verano y revisión de almohadillas por caminatas largas.'
    ),
    diagnosis: parrafos(
      'Piel sin lesiones. Ligera descamación en la zona lumbar, compatible con sequedad estacional. Oídos limpios.'
    ),
    treatmentNotes: parrafos(
      'Baño con champú hidratante, corte tipo verano, corte de uñas y limpieza de oídos.',
      'Se sugiere suplemento de ácidos grasos omega 3 durante un mes para la descamación.'
    ),
    weightKg: 27.4,
    servicios: [{ nombre: 'Baño y corte de pelo', cantidad: 1 }],
  },
  {
    etiqueta: 'Cirugía',
    consultorio: 'Quirófano',
    inicio: '2025-06-05T13:00:00.000Z',
    fin: '2025-06-05T16:00:00.000Z',
    reason: 'Vómito persistente de 48 horas y decaimiento',
    anamnesis: parrafos(
      'Cuadro de 48 horas de vómito posprandial, anorexia y decaimiento progresivo. La propietaria refiere que la paciente pudo haber ingerido parte de un juguete de goma el fin de semana.',
      'No hay diarrea. Última defecación hace 36 horas, escasa.'
    ),
    diagnosis: parrafos(
      'Cuerpo extraño gástrico confirmado por radiografía abdominal: estructura radiopaca de unos 4 cm en cámara gástrica.',
      'Hemograma sin leucocitosis significativa. Paciente estable para anestesia general.'
    ),
    treatmentNotes: parrafos(
      'Gastrotomía exploratoria bajo anestesia general. Se extrae fragmento de juguete de goma de 4,2 cm sin perforación de la pared gástrica.',
      'Antibioterapia con amoxicilina-clavulánico 12,5 mg/kg cada 12 horas durante 7 días y analgesia con meloxicam.',
      'Dieta blanda fraccionada durante 5 días. Reposo y collar isabelino. Retirar puntos a los 10 días.'
    ),
    weightKg: 26.1,
    nextControlOn: '2025-06-12',
    servicios: [
      { nombre: 'Consulta general', cantidad: 1 },
      { nombre: 'Radiografía abdominal', cantidad: 1 },
      { nombre: 'Hemograma completo', cantidad: 1 },
      { nombre: 'Anestesia general', cantidad: 1 },
      { nombre: 'Cirugía de tejidos blandos', cantidad: 1 },
    ],
  },
  {
    etiqueta: 'Control posquirúrgico',
    consultorio: 'Consultorio 1',
    inicio: '2025-06-12T14:00:00.000Z',
    fin: '2025-06-12T14:25:00.000Z',
    reason: 'Control posquirúrgico a los 7 días',
    anamnesis: parrafos(
      'La propietaria reporta buena recuperación, apetito recuperado desde el tercer día.',
      'Al cuarto día de antibiótico aparecieron ronchas en abdomen y prurito intenso, que cedieron al suspenderlo.'
    ),
    diagnosis: parrafos(
      'Evolución quirúrgica favorable: herida limpia, sin secreción ni dehiscencia.',
      'Reacción cutánea compatible con hipersensibilidad a amoxicilina-clavulánico.'
    ),
    treatmentNotes: parrafos(
      'Se retiran puntos. Se suspende definitivamente la amoxicilina y se registra la alergia en la ficha.',
      'Para futuras antibioterapias usar cefalosporinas o quinolonas según antibiograma.'
    ),
    weightKg: 26.5,
    servicios: [{ nombre: 'Control posquirúrgico', cantidad: 1 }],
    alergia: {
      allergen: 'Amoxicilina-clavulánico',
      category: 'medication',
      reaction: 'Urticaria generalizada en abdomen y cara interna de los muslos, con prurito intenso. Cede en 24 horas al suspender el fármaco.',
      severity: 'moderate',
      diagnosedOn: '2025-06-12',
      notes: 'Evitar penicilinas. Alternativas seguras: cefalexina, enrofloxacina.',
    },
  },
  {
    etiqueta: 'Vacunación anual',
    consultorio: 'Consultorio 1',
    inicio: '2026-04-18T15:00:00.000Z',
    fin: '2026-04-18T15:40:00.000Z',
    reason: 'Refuerzo anual de vacunas',
    anamnesis: parrafos(
      'Un año después de la cirugía, sin recidivas. Propietaria reporta actividad normal y buen apetito.'
    ),
    diagnosis: parrafos('Paciente sana. Cicatriz abdominal sin alteraciones.'),
    treatmentNotes: parrafos(
      'Se aplican refuerzos anuales de rabia y polivalente. Se deja constancia de la alergia a penicilinas en la historia.'
    ),
    weightKg: 28.0,
    servicios: [
      { nombre: 'Consulta general', cantidad: 1 },
      { nombre: 'Aplicación de vacuna', cantidad: 2 },
    ],
    vacunas: [
      { nombre: 'Rabia', dosis: 4, lote: 'RB-2026-0330', vence: '2027-06-30', proxima: '2027-04-18' },
      { nombre: 'Polivalente DHPPi+L', dosis: 4, lote: 'PV-2026-0215', vence: '2027-09-30', proxima: '2027-04-18' },
    ],
  },
  {
    etiqueta: 'Corte de pelo',
    consultorio: 'Sala de estética',
    inicio: '2026-08-14T14:30:00.000Z',
    fin: '2026-08-14T16:00:00.000Z',
    reason: 'Baño y corte de pelo',
    anamnesis: parrafos('Cita de estética de rutina. Sin novedades reportadas por la propietaria.'),
    diagnosis: parrafos('Piel y manto en buen estado. Sin parásitos externos.'),
    treatmentNotes: parrafos('Baño, corte, corte de uñas y limpieza de oídos. Sin incidencias.'),
    weightKg: 28.5,
    servicios: [{ nombre: 'Baño y corte de pelo', cantidad: 1 }],
  },
];

// --- creación --------------------------------------------------------------

async function asegurar(d, uid, filtros, datos) {
  const encontrado = await d(uid).findFirst({ filters: filtros });
  if (encontrado) return encontrado;
  return d(uid).create({ data: datos });
}

async function crearHistoria(app) {
  const d = (uid) => app.documents(uid);

  const mascota = await d('api::pet.pet').findFirst({ filters: { name: MASCOTA } });
  if (!mascota) throw new Error(`No existe la mascota "${MASCOTA}"; ejecuta antes node demo-data.js`);

  // --- catálogo ---
  const consultorios = {};
  for (const c of CONSULTORIOS) {
    consultorios[c.name] = await asegurar(d, 'api::scheduling.clinic-room', { name: c.name }, {
      ...c,
      isActive: true,
    });
  }

  const servicios = {};
  for (const s of SERVICIOS) {
    const categoria = await d('api::scheduling.service-category').findFirst({
      filters: { name: s.categoria },
    });
    servicios[s.name] = await asegurar(
      d,
      'api::scheduling.service',
      { name: s.name, category: { documentId: categoria.documentId } },
      {
        name: s.name,
        category: categoria.documentId,
        defaultDurationMinutes: s.defaultDurationMinutes,
        basePrice: s.basePrice,
        currency: 'COP',
        isActive: true,
      }
    );
  }

  const perro = await d('api::pet.species').findFirst({ filters: { name: 'Perro' } });
  const vacunas = {};
  for (const v of VACUNAS) {
    vacunas[v.name] = await asegurar(
      d,
      'api::clinical.vaccine',
      { name: v.name, species: { documentId: perro.documentId } },
      {
        name: v.name,
        species: perro.documentId,
        manufacturer: v.manufacturer,
        isMandatory: v.isMandatory,
        isActive: true,
      }
    );
  }

  // --- la veterinaria: usuario + perfil, sin customer ---
  let vet = await app
    .query('plugin::users-permissions.user')
    .findOne({ where: { username: VETERINARIO.username } });

  if (!vet) {
    const perfilVet = await asegurar(
      d,
      'api::identity.profile',
      { documentNumber: VETERINARIO.perfil.documentNumber },
      VETERINARIO.perfil
    );
    const rolVet = await app
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'veterinarian' } });

    vet = await app.plugin('users-permissions').service('user').add({
      username: VETERINARIO.username,
      email: VETERINARIO.email,
      password: VETERINARIO.password,
      provider: 'local',
      confirmed: true,
      blocked: false,
      role: rolVet.id,
      profile: perfilVet.documentId,
    });
  }

  // --- las visitas ---
  let creadas = 0;

  for (const v of VISITAS) {
    const yaExiste = await d('api::clinical.consultation').findFirst({
      filters: { pet: { documentId: mascota.documentId }, consultedAt: v.inicio },
    });
    if (yaExiste) continue;

    const cita = await d('api::scheduling.appointment').create({
      data: {
        pet: mascota.documentId,
        responsible: vet.documentId,
        room: consultorios[v.consultorio].documentId,
        startAt: v.inicio,
        endAt: v.fin,
        state: 'completed',
        source: 'front_desk',
        title: v.etiqueta,
        arrivedAt: v.inicio,
        completedAt: v.fin,
        // Sin duración ni precio: el middleware los copia del catálogo.
        services: v.servicios.map((s) => ({ service: servicios[s.nombre].documentId })),
      },
    });

    const consulta = await d('api::clinical.consultation').create({
      data: {
        pet: mascota.documentId,
        vet: vet.documentId,
        appointment: cita.documentId,
        consultedAt: v.inicio,
        reason: v.reason,
        anamnesis: v.anamnesis,
        diagnosis: v.diagnosis,
        treatmentNotes: v.treatmentNotes,
        weightKg: v.weightKg,
        ...(v.nextControlOn ? { nextControlOn: v.nextControlOn } : {}),
      },
    });

    for (const s of v.servicios) {
      const servicio = servicios[s.nombre];
      await d('api::scheduling.consultation-service').create({
        data: {
          consultation: consulta.documentId,
          service: servicio.documentId,
          quantity: s.cantidad,
          unitPrice: servicio.basePrice,
          durationMinutes: servicio.defaultDurationMinutes,
          performedBy: vet.documentId,
        },
      });
    }

    for (const vac of v.vacunas ?? []) {
      await d('api::clinical.pet-vaccination').create({
        data: {
          pet: mascota.documentId,
          vaccine: vacunas[vac.nombre].documentId,
          consultation: consulta.documentId,
          vet: vet.documentId,
          doseNumber: vac.dosis,
          appliedOn: v.inicio.slice(0, 10),
          nextDueOn: vac.proxima,
          batchNumber: vac.lote,
          batchExpiresOn: vac.vence,
        },
      });
    }

    if (v.alergia) {
      await d('api::clinical.allergy').create({
        data: {
          pet: mascota.documentId,
          consultation: consulta.documentId,
          vet: vet.documentId,
          isActive: true,
          ...v.alergia,
        },
      });
    }

    creadas++;
  }

  return { mascota: MASCOTA, visitas: creadas, vet: VETERINARIO.username };
}

/** Borra la historia y el catálogo que creó este módulo. */
async function borrarHistoria(app) {
  const d = (uid) => app.documents(uid);
  let n = 0;

  const mascota = await d('api::pet.pet').findFirst({ filters: { name: MASCOTA } });

  if (mascota) {
    const consultas = await d('api::clinical.consultation').findMany({
      filters: { pet: { documentId: mascota.documentId } },
    });

    for (const c of consultas) {
      for (const cs of await d('api::scheduling.consultation-service').findMany({
        filters: { consultation: { documentId: c.documentId } },
      })) {
        await d('api::scheduling.consultation-service').delete({ documentId: cs.documentId });
        n++;
      }
    }

    for (const uid of ['api::clinical.pet-vaccination', 'api::clinical.allergy']) {
      for (const r of await d(uid).findMany({ filters: { pet: { documentId: mascota.documentId } } })) {
        await d(uid).delete({ documentId: r.documentId });
        n++;
      }
    }

    for (const c of consultas) {
      await d('api::clinical.consultation').delete({ documentId: c.documentId });
      n++;
    }

    for (const a of await d('api::scheduling.appointment').findMany({
      filters: { pet: { documentId: mascota.documentId } },
    })) {
      await d('api::scheduling.appointment').delete({ documentId: a.documentId });
      n++;
    }
  }

  for (const v of VACUNAS) {
    for (const r of await d('api::clinical.vaccine').findMany({ filters: { name: v.name } })) {
      await d('api::clinical.vaccine').delete({ documentId: r.documentId });
      n++;
    }
  }
  for (const s of SERVICIOS) {
    for (const r of await d('api::scheduling.service').findMany({ filters: { name: s.name } })) {
      await d('api::scheduling.service').delete({ documentId: r.documentId });
      n++;
    }
  }
  for (const c of CONSULTORIOS) {
    for (const r of await d('api::scheduling.clinic-room').findMany({ filters: { name: c.name } })) {
      await d('api::scheduling.clinic-room').delete({ documentId: r.documentId });
      n++;
    }
  }

  const borrado = await app
    .query('plugin::users-permissions.user')
    .deleteMany({ where: { username: VETERINARIO.username } });
  n += borrado?.count ?? 0;

  for (const r of await d('api::identity.profile').findMany({
    filters: { documentNumber: VETERINARIO.perfil.documentNumber },
  })) {
    await d('api::identity.profile').delete({ documentId: r.documentId });
    n++;
  }

  return n;
}

module.exports = { crearHistoria, borrarHistoria, MASCOTA };
