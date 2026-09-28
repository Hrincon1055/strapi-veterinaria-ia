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
    ['api::scheduling.service', { name: 'Consulta SMOKE' }],    ['api::scheduling.appointment', { pet: { name: 'Fido SMOKE' } }],
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
  // Las líneas de servicio son ahora el componente repetible
  // `scheduling.consultation-service`: se escriben dentro de la consulta y el
  // veterinario solo dice qué hizo y cuántas veces; sin precios (eso será de
  // la facturación).
  const conLinea = await acepta(
    'línea de servicio con cantidad',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: { services: [{ service: servicio.documentId, quantity: 2 }] },
        populate: { services: { populate: ['service'] } },
      }),
    (r) => r.services?.[0]?.quantity === 2 && r.services?.[0]?.service?.documentId === servicio.documentId
  );
  // El panel manda la relación de una línea sin tocar como `{ connect: [], disconnect: [] }`.
  await acepta(
    'cambiar la cantidad desde el panel sin tocar el servicio',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: { services: [{ id: conLinea?.services?.[0]?.id, service: { connect: [], disconnect: [] }, quantity: 3 }] },
        populate: { services: { populate: ['service'] } },
      }),
    (r) => r.services?.[0]?.quantity === 3 && r.services?.[0]?.service?.documentId === servicio.documentId
  );
  await rechaza(
    'línea de servicio sin servicio',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: { services: [{ quantity: 1 }] },
      }),
    'debe indicar un servicio'
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
