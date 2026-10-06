'use strict';

/**
 * Hospitalización de muestra (sección 5.6 del documento de modelo).
 *
 *   - Clínica hospitaliza, con "Hospitalización (día)" como servicio por día.
 *   - Sala "Hospitalización" con cinco jaulas (una de UCI con su propio
 *     servicio por día).
 *   - Cuenta del panel del rol "Auxiliar de hospitalización":
 *     camila.rios@veterinaria.test (contraseña de demo del staff).
 *   - Rocco, ingresado hace dos días por una gastroenteritis: fluidoterapia,
 *     omeprazol y meloxicam, signos cada 6 h, una toma omitida y las de las
 *     últimas horas sin registrar (se ven atrasadas o pendientes).
 *   - Nube, dada de alta hace cuatro días tras dos días de observación.
 *
 * Las fechas son relativas a hoy: cada ejecución deja la hoja "viva". Nada se
 * factura: las dos quedan en Facturación → Pendientes de cobro.
 *
 * Escribe sin sesión del panel, así que "quién lo hizo" (admittedBy,
 * recordedBy, administeredBy…) lo pone este script con las cuentas de la demo.
 *
 * No se ejecuta suelto: lo usa demo-data.js (después de la agenda y antes de
 * las facturas; al borrar, antes de la historia, que borra el catálogo).
 */

const { cuentaDelPanel, borrarCuentaDelPanel } = require('./demo-staff');
const { VETERINARIO } = require('./demo-clinica');

const H = 'api::hospitalization.hospitalization';
const J = 'api::hospitalization.cage';
const O = 'api::hospitalization.treatment-order';
const E = 'api::hospitalization.evolution-entry';
const A = 'api::hospitalization.medication-administration';

const AUXILIAR = {
  email: 'camila.rios@veterinaria.test',
  rol: 'Auxiliar de hospitalización',
  perfil: {
    firstName: 'Camila', lastName: 'Ríos', documentType: 'cc',
    documentNumber: '1036221477', occupation: 'Auxiliar de enfermería veterinaria', gender: 'female',
  },
};

const IVA_SERVICIOS = { ivaTreatment: 'gravado', ivaRate: 19 };
const EXCLUIDO = { ivaTreatment: 'excluido', ivaRate: 0 };
const CATEGORIA = 'Hospitalización';
const SALA = 'Hospitalización';

const SERVICIOS = [
  { name: 'Hospitalización (día)', basePrice: 120000, colorHex: '#6FCF97' },
  { name: 'Hospitalización UCI (día)', basePrice: 240000, colorHex: '#EB5757' },
];

const JAULAS = [
  { name: 'Jaula 1', size: 'small', cageType: 'standard', sortOrder: 10 },
  { name: 'Jaula 2', size: 'medium', cageType: 'standard', sortOrder: 20 },
  { name: 'Jaula 3', size: 'large', cageType: 'standard', sortOrder: 30 },
  { name: 'UCI 1', size: 'large', cageType: 'icu', sortOrder: 40, servicio: 'Hospitalización UCI (día)' },
  { name: 'Aislamiento', size: 'medium', cageType: 'isolation', sortOrder: 50 },
];

/** Lo que se administra en la sala, en unidades que se cobran por toma. */
const PRODUCTOS = [
  {
    name: 'Lactato de Ringer 500 ml',
    productType: 'supply',
    presentation: 'Bolsa x 500 ml',
    saleUnit: 'bag',
    salePrice: 16000,
    tax: EXCLUIDO,
  },
  {
    name: 'Omeprazol inyectable 40 mg',
    productType: 'medication',
    presentation: 'Vial liofilizado 40 mg',
    saleUnit: 'vial',
    salePrice: 22000,
    tax: EXCLUIDO,
    details: {
      __component: 'catalog.medication-details',
      pharmaceuticalForm: 'injectable',
      route: 'iv',
      activeIngredients: [{ name: 'Omeprazol', strength: 40, strengthUnit: 'mg' }],
      requiresPrescription: true,
    },
  },
  {
    name: 'Meloxicam inyectable 5 mg/ml',
    productType: 'medication',
    presentation: 'Frasco x 20 ml (se cobra por ml)',
    saleUnit: 'ml',
    salePrice: 3500,
    tax: EXCLUIDO,
    details: {
      __component: 'catalog.medication-details',
      pharmaceuticalForm: 'injectable',
      route: 'sc',
      activeIngredients: [{ name: 'Meloxicam', strength: 5, strengthUnit: 'mg_ml' }],
      requiresPrescription: true,
    },
  },
];

const MOTIVO_ROCCO = 'Gastroenteritis hemorrágica: fluidoterapia, protector gástrico y analgesia';
const MOTIVO_NUBE = 'Observación tras ingesta de lirio (riesgo de lesión renal aguda)';

const HORA = 3600_000;
const iso = (t) => new Date(t).toISOString();
/** Instante redondeado a la hora en punto. */
const enPunto = (t) => Math.floor(t / HORA) * HORA;
const bloques = (texto) => texto.split('\n').map((l) => ({ type: 'paragraph', children: [{ type: 'text', text: l }] }));

async function asegurar(d, uid, filters, data) {
  const existente = await d(uid).findFirst({ filters });
  return existente ?? d(uid).create({ data });
}

async function catalogo(app) {
  const d = (uid) => app.documents(uid);

  let categoria = await d('api::scheduling.service-category').findFirst({ filters: { name: CATEGORIA } });
  if (!categoria) categoria = await d('api::scheduling.service-category').create({ data: { name: CATEGORIA, sortOrder: 60, isActive: true } });

  const servicios = {};
  for (const s of SERVICIOS) {
    servicios[s.name] = await asegurar(d, 'api::scheduling.service',
      { name: s.name, category: { documentId: categoria.documentId } },
      { ...s, category: categoria.documentId, defaultDurationMinutes: 30, currency: 'COP', tax: IVA_SERVICIOS, isActive: true });
  }

  const sala = await asegurar(d, 'api::scheduling.clinic-room', { name: SALA }, { name: SALA, roomType: 'hospitalization', isActive: true });
  const jaulas = {};
  for (const { servicio, ...j } of JAULAS) {
    jaulas[j.name] = await asegurar(d, J, { name: j.name }, {
      ...j,
      room: sala.documentId,
      ...(servicio ? { dailyService: servicios[servicio].documentId } : {}),
      isActive: true,
    });
  }

  const productos = {};
  for (const p of PRODUCTOS) {
    productos[p.name] = await asegurar(d, 'api::catalog.product', { name: p.name }, {
      ...p,
      currency: 'COP',
      ...(p.details ? { details: [p.details] } : {}),
      isActive: true,
    });
  }

  // Clínica hospitaliza (H1), con el servicio por día por defecto (H4).
  await app.service('api::clinic.clinic').createOrUpdate({
    data: { offersHospitalization: true, defaultHospitalizationDayService: servicios['Hospitalización (día)'].documentId },
  });

  return { servicios, jaulas, productos };
}

/** Rocco: ingresado hace dos días; la hoja llega hasta ahora. */
async function ingresarRocco(app, { jaulas, productos }, vet, auxiliar) {
  const d = (uid) => app.documents(uid);
  const rocco = await d('api::pet.pet').findFirst({ filters: { name: 'Rocco' } });
  if (!rocco) throw new Error('Falta Rocco (demo-data.js lo crea)');

  const ahora = Date.now();
  const ingreso = enPunto(ahora - 2 * 24 * HORA) - 2 * HORA;
  const h = await d(H).create({
    data: {
      pet: rocco.documentId,
      cage: jaulas['Jaula 2'].documentId,
      responsibleVet: vet.documentId,
      admittedBy: vet.documentId,
      admittedAt: iso(ingreso),
      reason: MOTIVO_ROCCO,
      admissionNotes: bloques('Ingresa con vómito y diarrea con sangre desde hace 24 h. Deshidratación moderada (7 %).\nSe deja con collar y manta del propietario.'),
    },
  });

  const ordenes = [
    { producto: 'Lactato de Ringer 500 ml', dose: '500 ml en 12 h (bomba)', doseQuantity: 1, route: 'iv', frequencyHours: 12, desde: ingreso },
    { producto: 'Omeprazol inyectable 40 mg', dose: '1 mg/kg', doseQuantity: 1, route: 'iv', frequencyHours: 24, desde: ingreso + HORA },
    { producto: 'Meloxicam inyectable 5 mg/ml', dose: '0,1 mg/kg', doseQuantity: 0.3, route: 'sc', frequencyHours: 24, desde: ingreso + 26 * HORA },
  ];

  let tomas = 0;
  let omitida = false;
  for (const o of ordenes) {
    const orden = await d(O).create({
      data: {
        hospitalization: h.documentId,
        product: productos[o.producto].documentId,
        dose: o.dose,
        doseQuantity: o.doseQuantity,
        route: o.route,
        frequencyHours: o.frequencyHours,
        startAt: iso(o.desde),
        prescribedBy: vet.documentId,
      },
    });
    // Las tomas ya pasadas, salvo las de las últimas 3 horas (quedan por registrar).
    for (let t = o.desde; t < ahora - 3 * HORA; t += o.frequencyHours * HORA) {
      const omitir = !omitida && o.producto.startsWith('Meloxicam');
      omitida = omitida || omitir;
      await d(A).create({
        data: {
          hospitalization: h.documentId,
          order: orden.documentId,
          scheduledFor: iso(t),
          administeredAt: iso(t + 10 * 60_000),
          administeredBy: auxiliar.documentId,
          ...(omitir
            ? { state: 'omitted', omissionReason: 'Vomitó al manipularlo; se valora con la Dra. Gómez' }
            : { state: 'given' }),
        },
      });
      tomas++;
    }
  }

  // Signos cada 6 h: fiebre y taquicardia que van cediendo.
  const temperaturas = [39.8, 39.6, 39.4, 39.1, 38.9, 38.8, 38.6, 38.6, 38.5];
  let n = 0;
  for (let t = ingreso + 30 * 60_000; t < ahora - HORA; t += 6 * HORA, n++) {
    const i = Math.min(n, temperaturas.length - 1);
    await d(E).create({
      data: {
        hospitalization: h.documentId,
        recordedAt: iso(t),
        recordedBy: auxiliar.documentId,
        temperatureC: temperaturas[i],
        heartRateBpm: 140 - i * 6,
        respiratoryRateRpm: 36 - i * 2,
        mucousMembranes: i < 2 ? 'pale' : 'normal',
        capillaryRefillSeconds: i < 2 ? 2.5 : 1.5,
        hydrationState: i < 3 ? 'moderate' : i < 6 ? 'mild' : 'normal',
        painScore: Math.max(1, 6 - i),
        mentation: i < 2 ? 'depressed' : 'alert',
        appetite: i < 4 ? 'none' : 'reduced',
        urinated: true,
        defecated: i % 2 === 0,
        vomited: i < 2,
        notes: n === 0 ? 'Vía venosa cefálica derecha. Tolera bien la manipulación.' : n === 5 ? 'Acepta agua; se ofrece dieta gastrointestinal en pequeñas cantidades.' : null,
        weightKg: n === 0 ? 12.1 : null,
      },
    });
  }
  return { hospitalizacion: h.documentId, tomas, signos: n };
}

/** Nube: dos días de observación y alta médica hace cuatro días. */
async function altaNube(app, { jaulas }, vet, auxiliar) {
  const d = (uid) => app.documents(uid);
  const nube = await d('api::pet.pet').findFirst({ filters: { name: 'Nube' } });
  if (!nube) throw new Error('Falta Nube (demo-data.js la crea)');

  const ingreso = enPunto(Date.now() - 6 * 24 * HORA) + 3 * HORA;
  const alta = ingreso + 44 * HORA;
  const h = await d(H).create({
    data: {
      pet: nube.documentId,
      cage: jaulas['Jaula 1'].documentId,
      responsibleVet: vet.documentId,
      admittedBy: vet.documentId,
      admittedAt: iso(ingreso),
      reason: MOTIVO_NUBE,
    },
  });
  for (let t = ingreso + HORA, i = 0; t < alta; t += 8 * HORA, i++) {
    await d(E).create({
      data: {
        hospitalization: h.documentId,
        recordedAt: iso(t),
        recordedBy: auxiliar.documentId,
        temperatureC: 38.4 + (i % 2) * 0.2,
        heartRateBpm: 180,
        respiratoryRateRpm: 30,
        hydrationState: 'normal',
        appetite: i < 2 ? 'reduced' : 'normal',
        urinated: true,
        notes: i === 0 ? 'Creatinina de ingreso normal; se repite a las 48 h.' : null,
      },
    });
  }
  await d(H).update({
    documentId: h.documentId,
    data: {
      state: 'discharged',
      dischargeType: 'medical',
      dischargedAt: iso(alta),
      dischargedBy: vet.documentId,
      dischargeSummary: bloques('Sin signos de lesión renal: creatinina y orina normales a las 48 h.\nComió y orinó con normalidad durante el ingreso.'),
      homeInstructions: bloques('Retirar de casa cualquier planta de la familia de los lirios.\nVigilar que orine y coma con normalidad; ante vómito o decaimiento, consultar de inmediato.'),
      dischargeMedications: [],
      followUpOn: iso(alta + 7 * 24 * HORA).slice(0, 10),
    },
  });
  return { hospitalizacion: h.documentId };
}

async function crearHospitalizacion(app, { password }) {
  const d = (uid) => app.documents(uid);
  const base = await catalogo(app);
  const auxiliar = await cuentaDelPanel(app, { ...AUXILIAR, password });
  const vet = await app.db.query('admin::user').findOne({ where: { email: VETERINARIO.email } });
  if (!vet) throw new Error(`Falta la cuenta ${VETERINARIO.email} (la crea la historia de la demo)`);

  const ya = await d(H).findMany({ filters: { reason: { $in: [MOTIVO_ROCCO, MOTIVO_NUBE] } }, fields: ['documentId'] });
  if (ya.length > 0) return { creadas: 0, auxiliar: AUXILIAR.email };

  const rocco = await ingresarRocco(app, base, vet, auxiliar);
  await altaNube(app, base, vet, auxiliar);
  return { creadas: 2, auxiliar: AUXILIAR.email, tomas: rocco.tomas, signos: rocco.signos };
}

/** Borra lo que crea este módulo. Devuelve cuántos registros. */
async function borrarHospitalizacion(app) {
  const d = (uid) => app.documents(uid);
  let n = 0;
  const hs = await d(H).findMany({ filters: { reason: { $in: [MOTIVO_ROCCO, MOTIVO_NUBE] } }, fields: ['documentId'] });
  const ids = hs.map((h) => h.documentId);

  if (ids.length > 0) {
    // Un renglón de una factura hecha a mano retendría las tomas: la demo se
    // borra entera, también lo que se haya cobrado de ella.
    n += await app.db.query('api::billing.invoice-item')
      .deleteMany({ where: { sourceHospitalization: { documentId: { $in: ids } } } })
      .then((r) => r.count);
    for (const uid of [A, E, O]) {
      for (const r of await d(uid).findMany({ filters: { hospitalization: { documentId: { $in: ids } } }, fields: ['documentId'], pagination: { limit: -1 } })) {
        await d(uid).delete({ documentId: r.documentId });
        n++;
      }
    }
    for (const id of ids) {
      await d(H).delete({ documentId: id });
      n++;
    }
  }

  // Jaulas sin otras hospitalizaciones (una creada a mano en la demo las retendría).
  for (const j of JAULAS) {
    for (const r of await d(J).findMany({ filters: { name: j.name } })) {
      try {
        await d(J).delete({ documentId: r.documentId });
        n++;
      } catch {
        // Tiene hospitalizaciones que no son de la demo: se deja.
      }
    }
  }
  for (const r of await d('api::scheduling.clinic-room').findMany({ filters: { name: SALA } })) {
    if ((await d(J).count({ filters: { room: { documentId: r.documentId } } })) === 0) {
      await d('api::scheduling.clinic-room').delete({ documentId: r.documentId });
      n++;
    }
  }
  for (const p of PRODUCTOS) {
    for (const r of await d('api::catalog.product').findMany({ filters: { name: p.name } })) {
      await d('api::catalog.product').delete({ documentId: r.documentId });
      n++;
    }
  }
  for (const s of SERVICIOS) {
    for (const r of await d('api::scheduling.service').findMany({ filters: { name: s.name } })) {
      await d('api::scheduling.service').delete({ documentId: r.documentId });
      n++;
    }
  }
  const categoria = await d('api::scheduling.service-category').findFirst({ filters: { name: CATEGORIA } });
  if (categoria && (await d('api::scheduling.service').count({ filters: { category: { documentId: categoria.documentId } } })) === 0) {
    await d('api::scheduling.service-category').delete({ documentId: categoria.documentId });
    n++;
  }
  n += await borrarCuentaDelPanel(app, { email: AUXILIAR.email, documentNumber: AUXILIAR.perfil.documentNumber });
  return n;
}

module.exports = { crearHospitalizacion, borrarHospitalizacion, AUXILIAR };
