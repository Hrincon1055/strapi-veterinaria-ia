'use strict';

/**
 * Prueba de humo de las reglas de la sección 8: carga Strapi, intenta escrituras
 * inválidas y comprueba que cada una se rechaza. No sustituye a las pruebas
 * Jest de la fase 2; sirve para verificar que los middlewares se disparan.
 *
 * Uso: node smoke-validations.js
 */

const { createStrapi, compileStrapi } = require('@strapi/strapi');
const { cuentaDelPanel, borrarCuentaDelPanel } = require('./demo-staff');

let pass = 0;
let fail = 0;

/** Espera que la operación falle con un mensaje que contenga `fragmento`. */
async function rechaza(titulo, fn, fragmento) {
  try {
    await fn();
    console.log(`  FALLO   ${titulo}\n            -> se aceptó cuando debía rechazarse`);
    fail++;
  } catch (e) {
    const msg = e.message ?? String(e);
    if (fragmento && !msg.toLowerCase().includes(fragmento.toLowerCase())) {
      console.log(`  FALLO   ${titulo}\n            -> rechazado, pero por otro motivo: ${msg}`);
      fail++;
    } else {
      console.log(`  ok      ${titulo}`);
      pass++;
    }
  }
}

/** Espera que la operación funcione y además cumpla una condición. */
async function acepta(titulo, fn, comprueba) {
  try {
    const r = await fn();
    if (comprueba && !comprueba(r)) {
      console.log(`  FALLO   ${titulo}\n            -> se guardó pero el resultado no es el esperado`);
      fail++;
    } else {
      console.log(`  ok      ${titulo}`);
      pass++;
    }
    return r;
  } catch (e) {
    console.log(`  FALLO   ${titulo}\n            -> se rechazó: ${e.message}`);
    fail++;
    return null;
  }
}

/**
 * Borra todo lo que crea esta prueba, identificado por claves naturales con
 * el sufijo SMOKE. Se ejecuta al principio y al final, así que la prueba se
 * puede repetir aunque una ejecución anterior se interrumpiera a medias.
 * El orden respeta las dependencias: primero lo que apunta a otros.
 */
async function limpiar(app) {
  const d = (uid) => app.documents(uid);
  const objetivos = [
    ['api::billing.benefit-usage', { benefit: { name: 'Baño SMOKE' } }],
    ['api::billing.invoice', { subscription: { plan: { name: 'Plan SMOKE' } } }],
    ['api::billing.subscription', { plan: { name: 'Plan SMOKE' } }],
    ['api::billing.plan-benefit', { name: 'Baño SMOKE' }],
    ['api::billing.plan', { name: 'Plan SMOKE' }],
    ['api::scheduling.appointment', { pet: { name: 'Fido SMOKE' } }],
    ['api::clinical.consultation', { pet: { name: 'Fido SMOKE' } }],
    ['api::scheduling.service', { name: 'Consulta SMOKE' }],
    ['api::catalog.product', { name: { $endsWith: 'SMOKE' } }],
    ['api::catalog.supplier', { name: { $endsWith: 'SMOKE' } }],
    ['api::clinical.vaccine', { name: 'Rabia SMOKE' }],
    ['api::scheduling.clinic-room', { name: 'Consultorio SMOKE' }],
    ['api::clinical.consultation', { pet: { name: 'Fido SMOKE' } }],
    ['api::pet.pet', { name: 'Fido SMOKE' }],
    ['api::pet.pet', { name: 'Fido SMOKE', archivedAt: { $notNull: true } }],
    ['api::pet.breed', { name: 'Siamés SMOKE' }],
    ['api::shared.contact', { profile: { documentNumber: 'SMOKE-1' } }],
    ['api::customer.customer', { profile: { documentNumber: 'SMOKE-1' } }],
    ['api::identity.profile', { documentNumber: 'SMOKE-1' }],
    ['api::identity.profile', { documentNumber: 'SMOKE-1', archivedAt: { $notNull: true } }],
  ];

  let n = 0;
  for (const [uid, filters] of objetivos) {
    const items = await d(uid).findMany({ filters });
    for (const item of items) {
      await d(uid).delete({ documentId: item.documentId });
      n++;
    }
  }
  return n + (await borrarCuentaDelPanel(app, { email: 'smoke-vet@example.test' }));
}

(async () => {
  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();
  const d = (uid) => app.documents(uid);

  const previos = await limpiar(app);
  if (previos > 0) console.log(`(se limpiaron ${previos} registros de una ejecución anterior)`);

  // Datos base
  const especie = await d('api::pet.species').findFirst({ filters: { name: 'Perro' } });
  const otraEspecie = await d('api::pet.species').findFirst({ filters: { name: 'Gato' } });

  const perfil = await d('api::identity.profile').create({
    data: { firstName: 'Ana', lastName: 'Ruiz', documentType: 'cc', documentNumber: 'SMOKE-1' },
  });
  const cliente = await d('api::customer.customer').create({
    data: { profile: perfil.documentId, consents: { marketing: true, sms: false, email: true, dataProcessing: true } },
  });
  const razaGato = await d('api::pet.breed').create({
    data: { species: otraEspecie.documentId, name: 'Siamés SMOKE' },
  });

  // Un veterinario de prueba: `consultation.vet` es obligatorio y apunta a
  // una cuenta del panel.
  const vet = await cuentaDelPanel(app, {
    email: 'smoke-vet@example.test',
    rol: 'Veterinario',
    password: 'Smoke12345',
  });

  console.log('\n--- relaciones obligatorias ---');
  await rechaza('pet sin owner ni species', () => d('api::pet.pet').create({ data: { name: 'Sin dueño' } }), 'obligatorio');
  await rechaza('contact sin profile', () => d('api::shared.contact').create({ data: { contactType: 'email', value: 'a@b.co' } }), 'obligatorio');

  console.log('\n--- formato de contacto ---');
  await rechaza('email inválido', () => d('api::shared.contact').create({ data: { profile: perfil.documentId, contactType: 'email', value: 'no-es-email' } }), 'correo');
  await rechaza('teléfono sin formato E.164', () => d('api::shared.contact').create({ data: { profile: perfil.documentId, contactType: 'phone', value: '3001234567' } }), 'E.164');
  await acepta('teléfono E.164 válido', () => d('api::shared.contact').create({ data: { profile: perfil.documentId, contactType: 'phone', value: '+573001234567' } }));

  console.log('\n--- unicidad compuesta ---');
  await rechaza('contacto duplicado (profile, contactType, value)', () => d('api::shared.contact').create({ data: { profile: perfil.documentId, contactType: 'phone', value: '+573001234567' } }), 'ya existe');
  await rechaza('perfil con documento repetido', () => d('api::identity.profile').create({ data: { firstName: 'Otro', lastName: 'Igual', documentType: 'cc', documentNumber: 'SMOKE-1' } }), 'ya existe');

  console.log('\n--- reglas condicionales de mascota ---');
  await rechaza('raza de otra especie', () => d('api::pet.pet').create({ data: { name: 'Fido', owner: cliente.documentId, species: especie.documentId, breed: razaGato.documentId } }), 'no pertenece');
  await rechaza('fecha de nacimiento futura', () => d('api::pet.pet').create({ data: { name: 'Fido', owner: cliente.documentId, species: especie.documentId, birthDate: '2030-01-01' } }), 'futura');
  await rechaza('sterilizedOn sin estado sterilized', () => d('api::pet.pet').create({ data: { name: 'Fido', owner: cliente.documentId, species: especie.documentId, sterilizationState: 'intact', sterilizedOn: '2024-01-01' } }), 'esterilización');

  const mascota = await acepta('mascota válida', () => d('api::pet.pet').create({ data: { name: 'Fido SMOKE', owner: cliente.documentId, species: especie.documentId } }));

  console.log('\n--- citas ---');
  const sala = await d('api::scheduling.clinic-room').create({ data: { name: 'Consultorio SMOKE', roomType: 'consultation' } });

  await rechaza('endAt anterior a startAt', () => d('api::scheduling.appointment').create({ data: { pet: mascota.documentId, responsible: vet.documentId, startAt: '2026-10-01T10:00:00.000Z', endAt: '2026-10-01T09:00:00.000Z', state: 'scheduled' } }), 'posterior');

  await acepta('cita válida', () => d('api::scheduling.appointment').create({ data: { pet: mascota.documentId, responsible: vet.documentId, room: sala.documentId, startAt: '2026-10-01T10:00:00.000Z', endAt: '2026-10-01T11:00:00.000Z', state: 'scheduled' } }));
  await rechaza('cita que solapa al mismo responsable', () => d('api::scheduling.appointment').create({ data: { pet: mascota.documentId, responsible: vet.documentId, startAt: '2026-10-01T10:30:00.000Z', endAt: '2026-10-01T11:30:00.000Z', state: 'scheduled' } }), 'se cruza');
  await rechaza('cancelar sin motivo', () => d('api::scheduling.appointment').create({ data: { pet: mascota.documentId, responsible: vet.documentId, startAt: '2026-11-01T10:00:00.000Z', endAt: '2026-11-01T11:00:00.000Z', state: 'cancelled' } }), 'motivo');

  console.log('\n--- consultas y servicios prestados ---');
  const consulta = await acepta('consulta válida, consultedAt se rellena solo', () => d('api::clinical.consultation').create({ data: { pet: mascota.documentId, vet: vet.documentId } }), (c) => !!c.consultedAt);

  const categoria = await d('api::scheduling.service-category').findFirst({});
  const servicio = await d('api::scheduling.service').create({ data: { category: categoria.documentId, name: 'Consulta SMOKE', defaultDurationMinutes: 30, basePrice: 50000 } });
  await rechaza('servicio duplicado en la misma categoría', () => d('api::scheduling.service').create({ data: { category: categoria.documentId, name: 'Consulta SMOKE', defaultDurationMinutes: 30 } }), 'ya existe');
  console.log('\n--- catálogo de productos ---');
  const vacunaClinica = await d('api::clinical.vaccine').create({ data: { name: 'Rabia SMOKE', species: especie.documentId } });
  await rechaza(
    'medicamento sin sus datos de medicamento',
    () => d('api::catalog.product').create({ data: { name: 'Meloxicam SMOKE', productType: 'medication' } }),
    'necesita'
  );
  await rechaza(
    'bloque de datos que no corresponde al tipo',
    () =>
      d('api::catalog.product').create({
        data: { name: 'Juguete SMOKE', productType: 'toy', details: [{ __component: 'catalog.food-details', foodType: 'dry' }] },
      }),
    'lleva'
  );
  await rechaza(
    'vacuna del catálogo sin vacuna clínica',
    () =>
      d('api::catalog.product').create({
        data: { name: 'Vacuna SMOKE', productType: 'vaccine', details: [{ __component: 'catalog.vaccine-details', dosesPerUnit: 1 }] },
      }),
    'qué vacuna'
  );
  await rechaza(
    'producto gravado sin tarifa de IVA válida',
    () =>
      d('api::catalog.product').create({
        data: { name: 'Champú SMOKE', productType: 'hygiene', tax: { ivaTreatment: 'gravado', ivaRate: 7 } },
      }),
    'tarifa'
  );
  const medicamento = await acepta(
    'medicamento válido; lleva lotes por defecto',
    () =>
      d('api::catalog.product').create({
        data: {
          name: 'Meloxicam SMOKE',
          productType: 'medication',
          salePrice: 42000,
          tax: { ivaTreatment: 'excluido' },
          details: [{ __component: 'catalog.medication-details', pharmaceuticalForm: 'oral_suspension', activeIngredients: [{ name: 'Meloxicam', strength: 1.5, strengthUnit: 'mg_ml' }] }],
        },
        populate: ['tax'],
      }),
    (r) => r.tracksBatches === true && r.tax?.ivaRate === 0
  );
  const vacunaProducto = await acepta(
    'vacuna del catálogo enlazada a la vacuna clínica',
    () =>
      d('api::catalog.product').create({
        data: { name: 'Nobivac SMOKE', productType: 'vaccine', details: [{ __component: 'catalog.vaccine-details', vaccine: vacunaClinica.documentId }] },
        populate: { details: { on: { 'catalog.vaccine-details': { populate: ['vaccine'] } } } },
      }),
    (r) => r.details?.[0]?.vaccine?.documentId === vacunaClinica.documentId
  );
  // El panel reenvía el bloque con la relación sin tocar: no debe perderse.
  await acepta(
    'editar la vacuna desde el panel sin tocar la vacuna clínica',
    () =>
      d('api::catalog.product').update({
        documentId: vacunaProducto?.documentId,
        data: { details: [{ __component: 'catalog.vaccine-details', id: vacunaProducto?.details?.[0]?.id, vaccine: { connect: [], disconnect: [] }, dosesPerUnit: 2 }] },
        populate: { details: { on: { 'catalog.vaccine-details': { populate: ['vaccine'] } } } },
      }),
    (r) => r.details?.[0]?.dosesPerUnit === 2 && r.details?.[0]?.vaccine?.documentId === vacunaClinica.documentId
  );
  await acepta(
    'juguete sin datos específicos (son opcionales)',
    () => d('api::catalog.product').create({ data: { name: 'Pelota SMOKE', productType: 'toy' } }),
    (r) => r.tracksBatches === false
  );
  await rechaza(
    'proveedor con dígito de verificación errado',
    () => d('api::catalog.supplier').create({ data: { name: 'Distribuidora SMOKE', documentType: 'nit', documentNumber: '900456789', verificationDigit: '0' } }),
    'dígito de verificación'
  );

  console.log('\n--- servicios y productos de la consulta ---');
  // Una línea = un servicio O un producto, con cantidad y estado. Sin precios:
  // eso será de la facturación, desde el catálogo.
  const conLineas = await acepta(
    'servicio aplicado + producto entregado + producto recomendado',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: {
          items: [
            { service: servicio.documentId, quantity: 1, state: 'applied' },
            { product: medicamento?.documentId, quantity: 2, state: 'dispensed' },
            { product: vacunaProducto?.documentId, quantity: 1, state: 'recommended' },
          ],
        },
        populate: { items: { populate: ['service', 'product'] } },
      }),
    (r) =>
      r.items?.length === 3 &&
      r.items[0].service?.documentId === servicio.documentId &&
      r.items[1].product?.documentId === medicamento?.documentId &&
      Number(r.items[1].quantity) === 2
  );
  // El panel manda la relación de una línea sin tocar como `{ connect: [], disconnect: [] }`.
  await acepta(
    'cambiar la cantidad desde el panel sin tocar el servicio',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: {
          items: (conLineas?.items ?? []).map((l, i) => ({
            id: l.id,
            service: { connect: [], disconnect: [] },
            product: { connect: [], disconnect: [] },
            quantity: i === 0 ? 3 : Number(l.quantity),
            state: l.state,
          })),
        },
        populate: { items: { populate: ['service', 'product'] } },
      }),
    (r) => Number(r.items?.[0]?.quantity) === 3 && r.items?.[0]?.service?.documentId === servicio.documentId && r.items?.length === 3
  );
  await rechaza(
    'línea sin servicio ni producto',
    () => d('api::clinical.consultation').update({ documentId: consulta.documentId, data: { items: [{ quantity: 1 }] } }),
    'debe indicar un servicio o un producto'
  );
  await rechaza(
    'línea con servicio y producto a la vez',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: { items: [{ service: servicio.documentId, product: medicamento?.documentId, quantity: 1 }] },
      }),
    'no los dos'
  );
  await rechaza(
    'servicio marcado como entregado',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: { items: [{ service: servicio.documentId, quantity: 1, state: 'dispensed' }] },
      }),
    'solo para productos'
  );

  console.log('\n--- facturas ---');
  await rechaza('factura sin suscripción ni consulta', () => d('api::billing.invoice').create({ data: { customer: cliente.documentId, amount: 1000, currency: 'COP' } }), 'exactamente a una');
  const plan = await d('api::billing.plan').create({ data: { name: 'Plan SMOKE', priceMonthly: 1000 } });
  const suscripcion = await d('api::billing.subscription').create({ data: { customer: cliente.documentId, pet: mascota.documentId, plan: plan.documentId, startOn: '2026-01-01', endOn: '2026-12-31' } });
  await rechaza('factura con suscripción y consulta a la vez', () => d('api::billing.invoice').create({ data: { customer: cliente.documentId, subscription: suscripcion.documentId, consultation: consulta.documentId, amount: 1000 } }), 'exactamente a una');

  const factura = await acepta('factura válida en borrador', () => d('api::billing.invoice').create({ data: { customer: cliente.documentId, subscription: suscripcion.documentId, amount: 1000, state: 'draft' } }));
  await d('api::billing.invoice').update({ documentId: factura.documentId, data: { state: 'issued' } });
  await rechaza('cambiar el importe de una factura ya emitida', () => d('api::billing.invoice').update({ documentId: factura.documentId, data: { amount: 99999 } }), 'solo admite cambios');

  console.log('\n--- beneficios ---');
  const beneficio = await d('api::billing.plan-benefit').create({ data: { plan: plan.documentId, name: 'Baño SMOKE', quantityPerYear: 1 } });
  await rechaza('consumir beneficio de una suscripción no activa', () => d('api::billing.benefit-usage').create({ data: { subscription: suscripcion.documentId, benefit: beneficio.documentId, usedAt: new Date().toISOString() } }), 'activa');

  console.log('\n--- alergias y documentos ---');
  await rechaza('alergia inactiva sin resolvedOn', () => d('api::clinical.allergy').create({ data: { pet: mascota.documentId, allergen: 'Polen', isActive: false } }), 'resolvedOn');
  await rechaza('documento firmado sin destinatario único', () => d('api::documents.signed-document').create({ data: { documentType: 'consent', title: 'X', customer: cliente.documentId, pet: mascota.documentId } }), 'exactamente');

  console.log('\n--- filtro de archivados ---');
  await d('api::pet.pet').update({ documentId: mascota.documentId, data: { archivedAt: new Date().toISOString() } });
  const visibles = await d('api::pet.pet').findMany({ filters: { name: 'Fido SMOKE' } });
  await acepta('una mascota archivada no aparece en findMany', () => Promise.resolve(visibles), (v) => v.length === 0);
  const conFiltro = await d('api::pet.pet').findMany({ filters: { name: 'Fido SMOKE', archivedAt: { $notNull: true } } });
  await acepta('sí aparece si se filtra por archivedAt explícitamente', () => Promise.resolve(conFiltro), (v) => v.length === 1);

  console.log('\n--- limpieza ---');
  console.log(`  ${await limpiar(app)} registros de prueba eliminados`);

  console.log(`\n=========  ${pass} correctas, ${fail} fallidas  =========`);
  await app.destroy();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('la prueba de humo no pudo ejecutarse:', e);
  process.exit(2);
});
