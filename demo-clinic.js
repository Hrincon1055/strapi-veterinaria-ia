'use strict';

/**
 * Datos de muestra de la clínica (single type `api::clinic.clinic`).
 *
 * Lo usa `demo-data.js`; no se ejecuta suelto.
 *
 * El NIT y su dígito de verificación son coherentes entre sí a propósito: si
 * no lo fueran, la validación rechazaría el seed y no habría forma de arrancar
 * con datos. El DV se calcula, no se escribe a mano.
 *
 * NADA de credenciales aquí. Las claves de Dataico y el certificado de firma
 * van en el `.env`, no en un content type que se lee por API y se exporta a
 * CSV.
 */

const NIT = '901456789';

/** Módulo 11 de la DIAN; mismo algoritmo que la validación, para no desalinearse. */
function digitoVerificacion(nit) {
  const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const suma = [...String(nit).replace(/\D/g, '')]
    .reverse()
    .reduce((acc, d, i) => acc + Number(d) * PESOS[i], 0);
  const resto = suma % 11;
  return resto < 2 ? resto : 11 - resto;
}

const HORARIO = [
  ['monday', '07:30:00.000', '19:00:00.000'],
  ['tuesday', '07:30:00.000', '19:00:00.000'],
  ['wednesday', '07:30:00.000', '19:00:00.000'],
  ['thursday', '07:30:00.000', '19:00:00.000'],
  ['friday', '07:30:00.000', '19:00:00.000'],
  ['saturday', '08:00:00.000', '14:00:00.000'],
].map(([dayOfWeek, opensAt, closesAt]) => ({ dayOfWeek, opensAt, closesAt, isClosed: false }));

HORARIO.push({ dayOfWeek: 'sunday', isClosed: true, notes: 'Solo urgencias' });

/** "Consulta general" del catálogo de la demo, o null si aún no existe. */
async function servicioDeConsulta(app) {
  const s = await app.documents('api::scheduling.service').findFirst({ filters: { name: 'Consulta general' } });
  return s?.documentId ?? null;
}

async function crearClinica(app) {
  // Un single type se escribe con createOrUpdate del servicio de factoría, no
  // con documents().update(): sin documentId, update no crea nada y falla en
  // silencio (valida, pero no escribe).
  const svc = app.service('api::clinic.clinic');

  const existente = await svc.find({ populate: ['defaultConsultationService'] });
  if (existente?.legalName === 'Veterinaria San Roque S.A.S.') {
    // Clínica creada antes de que existiera el campo: se completa sin tocar lo demás.
    if (!existente.defaultConsultationService) {
      const consulta = await servicioDeConsulta(app);
      if (consulta) await svc.createOrUpdate({ data: { defaultConsultationService: consulta } });
    }
    return { creada: false, nombre: existente.legalName };
  }

  const colombia = await app
    .documents('api::shared.country')
    .findFirst({ filters: { isoCode: 'CO' } });

  await svc.createOrUpdate({
    data: {
      legalName: 'Veterinaria San Roque S.A.S.',
      tradeName: 'San Roque',
      slogan: 'Cuidamos a los que te cuidan',

      documentType: 'nit',
      documentNumber: NIT,
      verificationDigit: String(digitoVerificacion(NIT)),
      personType: 'juridica',
      taxRegime: 'responsable_iva',
      // O-13 gran contribuyente no aplica; O-15 autorretenedor tampoco.
      // R-99-PN es "no responsable de otras obligaciones", lo habitual en una
      // clínica pequeña responsable de IVA.
      fiscalResponsibilities: [{ code: 'r_99_pn' }],
      // 7500: actividades veterinarias (CIIU rev. 4 A.C.)
      ciiuCode: '7500',
      merchantRegistration: '21-546789-12',

      fiscalAddress: {
        addressType: 'work',
        addressLine: 'Carrera 43A #18-95, local 102',
        city: 'Medellín',
        region: 'Antioquia',
        postalCode: '050021',
        ...(colombia ? { country: colombia.documentId } : {}),
        isPrimary: true,
      },
      phone: '+576044441234',
      whatsapp: '+573001234567',
      email: 'contacto@sanroque.test',
      billingEmail: 'facturacion@sanroque.test',
      website: 'https://sanroque.test',

      resolutions: [
        {
          resolutionNumber: '18764003456789',
          resolutionDate: '2025-02-01',
          prefix: 'FE',
          rangeFrom: 1,
          rangeTo: 5000,
          currentNumber: 128,
          validFrom: '2025-02-01',
          validUntil: '2027-02-01',
          isActive: true,
        },
      ],
      invoicingEnvironment: 'habilitacion',
      defaultCurrency: 'COP',
      // Sin afirmar que es factura electrónica: mientras no haya integración
      // con la DIAN no lo es, y el PDF ya lo dice en su cabecera.
      invoiceFooterNotes:
        'Los servicios veterinarios prestados no generan garantía de resultado.',

      openingHours: HORARIO,
      timezone: 'America/Bogota',
      emergencyPhone: '+573009998877',
      // El cargo que "Finalizar atención" propone si la consulta no tiene
      // servicio. Los servicios los crea demo-clinica.js, antes que esto.
      defaultConsultationService: await servicioDeConsulta(app),
    },
  });

  return { creada: true, nombre: 'Veterinaria San Roque S.A.S.', nit: `${NIT}-${digitoVerificacion(NIT)}` };
}

/**
 * Un single type no se borra: se vacía. Se dejan solo los campos obligatorios
 * para que el registro siga siendo válido.
 */
async function borrarClinica(app) {
  const svc = app.service('api::clinic.clinic');
  const actual = await svc.find({});
  if (!actual) return 0;

  await svc.createOrUpdate({
    data: {
      legalName: 'Sin configurar',
      tradeName: null,
      slogan: null,
      documentNumber: '0',
      verificationDigit: null,
      fiscalResponsibilities: [],
      resolutions: [],
      openingHours: [],
      fiscalAddress: null,
      phone: null,
      whatsapp: null,
      email: null,
      billingEmail: null,
      website: null,
      invoiceFooterNotes: null,
      emergencyPhone: null,
      defaultConsultationService: null,
      ciiuCode: null,
      merchantRegistration: null,
    },
  });
  return 1;
}

module.exports = { crearClinica, borrarClinica, digitoVerificacion };
