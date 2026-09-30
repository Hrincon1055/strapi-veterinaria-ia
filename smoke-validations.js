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
/** La fija la sección de facturas: devuelve el consecutivo de Clínica a donde estaba. */
let restaurarConsecutivo = async () => {};
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

  // Las facturas emitidas o anuladas no se pueden borrar por el Document
  // Service (es la regla que se prueba), así que se borran con el query engine.
  // Primero los renglones: retienen las líneas de consulta.
  let n = 0;
  const facturas = await app.db.query('api::billing.invoice').findMany({
    where: { customer: { profile: { documentNumber: { $startsWith: 'SMOKE-' } } } },
    select: ['id'],
  });
  const ids = facturas.map((f) => f.id);
  if (ids.length > 0) {
    n += await app.db.query('api::billing.invoice-item').deleteMany({ where: { invoice: { id: { $in: ids } } } }).then((r) => r.count);
    n += await app.db.query('api::billing.invoice').deleteMany({ where: { id: { $in: ids } } }).then((r) => r.count);
  }

  const objetivos = [
    ['api::billing.benefit-usage', { benefit: { name: 'Baño SMOKE' } }],
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
    ['api::shared.contact', { profile: { documentNumber: { $startsWith: 'SMOKE-' } } }],
    ['api::customer.customer', { profile: { documentNumber: { $startsWith: 'SMOKE-' } } }],
    ['api::identity.profile', { documentNumber: { $startsWith: 'SMOKE-' } }],
    ['api::identity.profile', { documentNumber: { $startsWith: 'SMOKE-' }, archivedAt: { $notNull: true } }],
  ];

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
  // El panel reenvía la categoría sin tocar como `{ connect: [], disconnect: [] }`.
  await acepta('editar un servicio desde el panel sin tocar la categoría', () =>
    d('api::scheduling.service').update({ documentId: servicio.documentId, data: { category: { connect: [], disconnect: [] }, defaultDurationMinutes: 40 }, populate: ['category'] }),
    (r) => r.defaultDurationMinutes === 40 && r.category?.documentId === categoria.documentId);
  const otraCategoria = await d('api::scheduling.service-category').findFirst({ filters: { documentId: { $ne: categoria.documentId } } });
  const cambiar = (de, a) => ({ connect: [{ id: a.id, documentId: a.documentId, locale: null, isTemporary: true }], disconnect: [{ id: de.id, documentId: de.documentId, locale: null }] });
  await acepta('cambiar la categoría de un servicio desde el panel', () =>
    d('api::scheduling.service').update({ documentId: servicio.documentId, data: { category: cambiar(categoria, otraCategoria) }, populate: ['category'] }),
    (r) => r.category?.documentId === otraCategoria.documentId);
  await d('api::scheduling.service').update({ documentId: servicio.documentId, data: { category: cambiar(otraCategoria, categoria) } });
  await rechaza('quitar la categoría de un servicio', () =>
    d('api::scheduling.service').update({ documentId: servicio.documentId, data: { category: { connect: [], disconnect: [{ documentId: categoria.documentId }] } } }), 'obligatorio');
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
  // Dynamic zone `lines`: una tarjeta por tipo (Servicio / Producto), con
  // cantidad y estado. Sin precios: eso será de la facturación, desde el
  // catálogo. `label` lo pone el servidor para la cabecera del bloque.
  const POP_LINEAS = { lines: { on: { 'clinical.service-line': { populate: ['service'] }, 'clinical.product-line': { populate: ['product'] } } } };
  const conLineas = await acepta(
    'servicio aplicado + producto entregado + producto recomendado; label lo pone el servidor',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: {
          lines: [
            { __component: 'clinical.service-line', service: servicio.documentId, quantity: 1, state: 'applied', label: 'FALSO' },
            { __component: 'clinical.product-line', product: medicamento?.documentId, quantity: 2, state: 'dispensed' },
            { __component: 'clinical.product-line', product: vacunaProducto?.documentId, quantity: 1, state: 'recommended' },
          ],
        },
        populate: POP_LINEAS,
      }),
    (r) =>
      r.lines?.length === 3 &&
      r.lines[0].service?.documentId === servicio.documentId &&
      r.lines[0].label === 'Consulta SMOKE' &&
      r.lines[1].product?.documentId === medicamento?.documentId &&
      String(r.lines[1].label).startsWith('Meloxicam SMOKE') &&
      Number(r.lines[1].quantity) === 2
  );
  // El panel reenvía cada bloque con la relación sin tocar como `{ connect: [], disconnect: [] }`.
  await acepta(
    'cambiar la cantidad desde el panel sin tocar el servicio ni el producto',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: {
          lines: (conLineas?.lines ?? []).map((l, i) => {
            const campo = l.__component === 'clinical.service-line' ? 'service' : 'product';
            return { __component: l.__component, id: l.id, [campo]: { connect: [], disconnect: [] }, quantity: i === 0 ? 3 : Number(l.quantity), state: l.state };
          }),
        },
        populate: POP_LINEAS,
      }),
    (r) =>
      Number(r.lines?.[0]?.quantity) === 3 &&
      r.lines?.[0]?.service?.documentId === servicio.documentId &&
      r.lines?.[1]?.product?.documentId === medicamento?.documentId &&
      r.lines?.length === 3
  );
  // `lineKey`: la identidad de la línea para la facturación. La pone el
  // servidor, se conserva al editar y nunca se repite dentro de la consulta.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const claves = (r) => (r?.lines ?? []).map((l) => l.lineKey);
  const leer = () => d('api::clinical.consultation').findOne({ documentId: consulta.documentId, populate: POP_LINEAS });
  const base = await leer();
  await acepta('cada línea recibe una clave UUID distinta', () => Promise.resolve(base), (r) =>
    claves(r).length === 3 && claves(r).every((k) => UUID.test(k)) && new Set(claves(r)).size === 3);
  await acepta(
    'la clave sobrevive a una edición desde el panel e ignora la que llegue',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: {
          lines: base.lines.map((l) => {
            const campo = l.__component === 'clinical.service-line' ? 'service' : 'product';
            return { __component: l.__component, id: l.id, [campo]: { connect: [], disconnect: [] }, quantity: Number(l.quantity), state: l.state, lineKey: 'FALSA' };
          }),
        },
        populate: POP_LINEAS,
      }),
    (r) => JSON.stringify(claves(r)) === JSON.stringify(claves(base))
  );
  await acepta(
    'un bloque duplicado (sin id, con la clave del original) recibe clave nueva',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: {
          lines: [
            ...base.lines.map((l) => ({ __component: l.__component, id: l.id, quantity: Number(l.quantity), state: l.state })),
            { __component: 'clinical.service-line', service: servicio.documentId, quantity: 1, state: 'applied', lineKey: base.lines[0].lineKey },
          ],
        },
        populate: POP_LINEAS,
      }),
    (r) => claves(r).length === 4 && claves(r)[0] === base.lines[0].lineKey && new Set(claves(r)).size === 4 && UUID.test(claves(r)[3])
  );
  await acepta(
    'reenviar la zona por API sin ids pero con las claves guardadas las conserva',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: {
          lines: base.lines.map((l) => {
            const campo = l.__component === 'clinical.service-line' ? 'service' : 'product';
            return { __component: l.__component, [campo]: l[campo].documentId, quantity: Number(l.quantity), state: l.state, lineKey: l.lineKey };
          }),
        },
        populate: POP_LINEAS,
      }),
    (r) => JSON.stringify(claves(r)) === JSON.stringify(claves(base))
  );

  await rechaza(
    'tarjeta de servicio sin servicio',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: { lines: [{ __component: 'clinical.service-line', quantity: 1 }] },
      }),
    'qué servicio'
  );
  await rechaza(
    'tarjeta de producto sin producto',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: { lines: [{ __component: 'clinical.product-line', quantity: 1 }] },
      }),
    'qué producto'
  );
  // Lo impone el esquema de la tarjeta, no una regla: su enum no tiene `dispensed`.
  await rechaza(
    'servicio marcado como entregado',
    () =>
      d('api::clinical.consultation').update({
        documentId: consulta.documentId,
        data: { lines: [{ __component: 'clinical.service-line', service: servicio.documentId, quantity: 1, state: 'dispensed' }] },
      })
  );

  console.log('\n--- facturas ---');
  // Las líneas de la consulta SMOKE en este punto (ver arriba): servicio
  // "Consulta SMOKE" 50 000 × 3 aplicado, Meloxicam 42 000 × 2 entregado
  // (excluido de IVA) y Nobivac recomendado.
  const F = 'api::billing.invoice';
  const R = 'api::billing.invoice-item';
  const fact = app.service('api::billing.invoicing');

  // Emitir consume números de la resolución activa de Clínica (la de la
  // demo). Se anota dónde estaba y se devuelve ahí al terminar.
  const clinica = await d('api::clinic.clinic').findFirst({ populate: ['resolutions'] });
  const resolucion = clinica?.resolutions?.find((r) => r.isActive);
  if (!resolucion) throw new Error('la prueba necesita Clínica con una resolución activa: ejecuta node demo-data.js');
  const TABLA_RES = app.db.metadata.get('billing.dian-resolution').tableName;
  const consecutivo = async () => {
    const f = await app.db.connection(TABLA_RES).where({ id: resolucion.id }).first('current_number', 'range_from');
    return f.current_number == null ? Number(f.range_from) - 1 : Number(f.current_number);
  };
  const consecutivoInicial = await consecutivo();
  const valorOriginal = (await app.db.connection(TABLA_RES).where({ id: resolucion.id }).first('current_number')).current_number;
  restaurarConsecutivo = () => app.db.connection(TABLA_RES).where({ id: resolucion.id }).update({ current_number: valorOriginal });
  const [lineaServicio, lineaMedicamento, lineaRecomendada] = base.lines;
  const renglonDe = (factura, linea, extra = {}) => ({
    invoice: factura.documentId,
    kind: linea.__component === 'clinical.service-line' ? 'consultation_service' : 'consultation_product',
    sourceConsultation: consulta.documentId,
    sourceLineKey: linea.lineKey,
    ...extra,
  });

  const plan = await d('api::billing.plan').create({ data: { name: 'Plan SMOKE', priceMonthly: 1000 } });
  const suscripcion = await d('api::billing.subscription').create({ data: { customer: cliente.documentId, pet: mascota.documentId, plan: plan.documentId, startOn: '2026-01-01', endOn: '2026-12-31' } });

  await rechaza('una factura no nace emitida', () => d(F).create({ data: { customer: cliente.documentId, state: 'issued' } }), 'nace en borrador');
  const borrador = await acepta('borrador sin renglones, total 0', () => d(F).create({ data: { customer: cliente.documentId } }), (r) => r.state === 'draft' && r.amount === 0);

  await rechaza('cobrar un servicio sin perfil tributario en el catálogo', () => d(R).create({ data: renglonDe(borrador, lineaServicio) }), 'perfil tributario');
  await d('api::scheduling.service').update({ documentId: servicio.documentId, data: { tax: { ivaTreatment: 'gravado', ivaRate: 19 } } });

  const rServicio = await acepta(
    'renglón de la consulta: precio, IVA y cantidad salen del catálogo y de la línea',
    () => d(R).create({ data: renglonDe(borrador, lineaServicio, { quantity: 99, unitPrice: undefined }) }),
    (r) => r.unitPrice === 50000 && Number(r.quantity) === 3 && r.lineSubtotal === 150000 && r.lineTax === 28500 &&
      r.lineTotal === 178500 && r.lockKey === lineaServicio.lineKey && r.description === 'Consulta SMOKE'
  );
  await acepta(
    'renglón de producto entregado con descuento',
    () => d(R).create({ data: renglonDe(borrador, lineaMedicamento, { discountAmount: 4000 }) }),
    (r) => r.unitPrice === 42000 && r.lineSubtotal === 80000 && r.lineTax === 0 && r.unit === 'unit'
  );
  await acepta('la factura suma sus renglones', () => d(F).findOne({ documentId: borrador.documentId }), (r) =>
    r.subtotal === 234000 && r.discountTotal === 4000 && r.taxTotal === 28500 && r.amount === 258500);

  await acepta('PDF de un borrador: vista previa con los datos actuales', () => app.service('api::billing.invoice-pdf').generar(borrador.documentId),
    (r) => Buffer.isBuffer(r.pdf) && r.pdf.subarray(0, 5).toString() === '%PDF-' && r.pdf.length > 2000 && r.nombreArchivo === `Borrador-${borrador.documentId}.pdf`);
  await rechaza('cobrar una línea recomendada', () => d(R).create({ data: renglonDe(borrador, lineaRecomendada) }), 'no es facturable');
  await rechaza('renglón de consulta sin línea', () => d(R).create({ data: { invoice: borrador.documentId, kind: 'consultation_service', sourceConsultation: consulta.documentId } }), 'sourceLineKey');
  await rechaza('renglón de un tipo que no lleva esa relación', () => d(R).create({ data: { invoice: borrador.documentId, kind: 'custom', description: 'X', unitPrice: 1, taxTreatment: 'excluido', product: medicamento.documentId } }), 'no lleva product');
  await rechaza('cargo libre sin precio', () => d(R).create({ data: { invoice: borrador.documentId, kind: 'custom', description: 'Cargo SMOKE', taxTreatment: 'excluido' } }), 'precio unitario');
  await rechaza('descuento mayor que el renglón', () => d(R).create({ data: { invoice: borrador.documentId, kind: 'custom', description: 'Cargo SMOKE', unitPrice: 1000, discountAmount: 2000, taxTreatment: 'excluido' } }), 'supera');

  // --- precio manual (D5): solo por invoicing.cambiarPrecio y con motivo ---
  await rechaza('cambiar el precio de catálogo por el Document Service (Content Manager)', () => d(R).update({ documentId: rServicio.documentId, data: { unitPrice: 60000 } }), 'es el del catálogo');
  await rechaza('cambiar el precio sin motivo', () => fact.cambiarPrecio(rServicio.documentId, { unitPrice: 60000, motivo: '  ' }), 'motivo');
  await acepta('cambiar el precio con motivo', () => fact.cambiarPrecio(rServicio.documentId, { unitPrice: 60000, motivo: 'SMOKE precio variable' }),
    (r) => r.unitPrice === 60000 && r.priceOverrideReason === 'SMOKE precio variable' && r.lineSubtotal === 180000);
  await acepta('el panel reenvía precio y motivo sin cambios al guardar otra cosa', () => d(R).update({ documentId: rServicio.documentId, data: { unitPrice: 60000, priceOverrideReason: 'SMOKE precio variable', discountAmount: 0 } }),
    (r) => r.unitPrice === 60000 && r.priceOverrideReason === 'SMOKE precio variable');
  await rechaza('reescribir el motivo sin cambiar el precio', () => d(R).update({ documentId: rServicio.documentId, data: { priceOverrideReason: 'otro' } }), 'solo se escribe');
  await fact.cambiarPrecio(rServicio.documentId, { unitPrice: 50000, motivo: 'SMOKE vuelta al catálogo' });

  // --- no se cobra dos veces ---
  const otroBorrador = await d(F).create({ data: { customer: cliente.documentId } });
  await rechaza('la misma línea en otro borrador', () => d(R).create({ data: renglonDe(otroBorrador, lineaServicio) }), 'ya se está cobrando');
  await rechaza(
    'la base de datos también lo impide (índice único parcial sobre lock_key)',
    () => app.db.query(R).create({ data: { kind: 'custom', description: 'Salto SMOKE', quantity: 1, lockKey: lineaServicio.lineKey } }),
    'unique'
  );
  const perfil2 = await d('api::identity.profile').create({ data: { firstName: 'Otro', lastName: 'Cliente', documentType: 'cc', documentNumber: 'SMOKE-2' } });
  const cliente2 = await d('api::customer.customer').create({ data: { profile: perfil2.documentId, consents: { marketing: false, sms: false, email: false, dataProcessing: true } } });
  const deOtro = await d(F).create({ data: { customer: cliente2.documentId } });
  await rechaza('cobrar la consulta de la mascota de otro cliente', () => d(R).create({ data: renglonDe(deOtro, lineaMedicamento) }), 'otro cliente');

  // --- la cabecera ---
  await acepta('los totales no se escriben a mano', () => d(F).update({ documentId: borrador.documentId, data: { amount: 1 } }), (r) => r.amount === 258500);
  await rechaza('numerar a mano un borrador', () => d(F).update({ documentId: borrador.documentId, data: { fullNumber: 'X-1' } }), 'al emitir');
  await rechaza('emitir sin pasar por el módulo, aunque traiga numeración',
    () => d(F).update({ documentId: borrador.documentId, data: { state: 'issued', prefix: 'X', number: 1, fullNumber: 'X1', issuedAt: new Date().toISOString() } }),
    'módulo de facturación');
  await rechaza('emitir un borrador vacío', () => fact.emitir(otroBorrador.documentId), 'sin renglones');
  await acepta('…y el consecutivo no se consume', () => consecutivo(), (n) => n === consecutivoInicial);
  await rechaza('un borrador no se anula', () => d(F).update({ documentId: borrador.documentId, data: { state: 'voided', voidReason: 'x' } }), 'se borra');
  await rechaza('pagar un borrador', () => d(F).update({ documentId: borrador.documentId, data: { paymentState: 'paid' } }), 'pagada');

  const esperado = `${resolucion.prefix ?? ''}${consecutivoInicial + 1}`;
  const emitida = await acepta(
    'emitir: siguiente consecutivo de la resolución y datos congelados',
    async () => {
      await fact.emitir(borrador.documentId);
      // La etiqueta se recalcula después de la escritura: se relee.
      return d(F).findOne({ documentId: borrador.documentId, populate: ['buyer'] });
    },
    (r) => r.state === 'issued' && r.fullNumber === esperado && Number(r.number) === consecutivoInicial + 1 &&
      r.resolutionNumber === resolucion.resolutionNumber && Number(r.resolutionRangeTo) === Number(resolucion.rangeTo) &&
      r.buyer?.name === 'Ana Ruiz' && r.buyer?.documentNumber === 'SMOKE-1' &&
      r.issuerSnapshot?.legalName === clinica.legalName && !('technicalKey' in r.issuerSnapshot) &&
      r.searchLabel?.startsWith(`${esperado} · Ana Ruiz`)
  );
  await acepta('la resolución de Clínica avanzó un número', () => consecutivo(), (n) => n === consecutivoInicial + 1);
  await rechaza('emitir otra vez una emitida', () => fact.emitir(borrador.documentId), 'solo se emite un borrador');
  await acepta('PDF de la emitida, con sus datos congelados', () => app.service('api::billing.invoice-pdf').generar(borrador.documentId),
    (r) => Buffer.isBuffer(r.pdf) && r.pdf.subarray(0, 5).toString() === '%PDF-' && r.pdf.length > 2000 && r.nombreArchivo === `Factura-${esperado}.pdf`);
  await rechaza('cambiar a mano los datos congelados de una emitida',
    () => d(F).update({ documentId: borrador.documentId, data: { buyer: { name: 'Otro' } } }), 'solo admite cambios');
  await rechaza('añadir un renglón a una emitida', () => d(R).create({ data: { invoice: borrador.documentId, kind: 'custom', description: 'Cargo SMOKE', unitPrice: 1000, taxTreatment: 'excluido' } }), 'ya no es un borrador');
  await rechaza('quitar un renglón de una emitida', () => d(R).delete({ documentId: rServicio.documentId }), 'ya no es un borrador');
  await rechaza('cambiar las notas de una emitida', () => d(F).update({ documentId: borrador.documentId, data: { notes: 'cambio' } }), 'solo admite cambios');
  await acepta(
    'guardar desde el panel una emitida sin tocar nada y marcarla pagada',
    () => d(F).update({
      documentId: borrador.documentId,
      data: {
        currency: emitida.currency, notes: emitida.notes, amount: emitida.amount, fullNumber: emitida.fullNumber,
        issuedAt: emitida.issuedAt, number: emitida.number, paymentState: 'paid',
      },
    }),
    (r) => r.paymentState === 'paid' && r.amount === 258500
  );
  await rechaza('borrar una emitida', () => d(F).delete({ documentId: borrador.documentId }), 'se anula');
  await rechaza('archivar una emitida', () => d(F).update({ documentId: borrador.documentId, data: { archivedAt: new Date().toISOString() } }), 'se anula');
  await rechaza('anular una factura ya enviada a la DIAN (requiere nota crédito)', async () => {
    await d(F).update({ documentId: borrador.documentId, data: { dataicoInvoiceId: 'SMOKE-DIAN-1' } });
    try {
      return await d(F).update({ documentId: borrador.documentId, data: { state: 'voided', voidReason: 'x' } });
    } finally {
      await d(F).update({ documentId: borrador.documentId, data: { dataicoInvoiceId: null } });
    }
  }, 'nota crédito');
  await rechaza('anular sin motivo', () => d(F).update({ documentId: borrador.documentId, data: { state: 'voided' } }), 'motivo');

  // --- anular libera los conceptos ---
  await acepta('anular con motivo', () => d(F).update({ documentId: borrador.documentId, data: { state: 'voided', voidReason: 'Prueba SMOKE' } }), (r) => r.state === 'voided' && !!r.voidedAt);
  await acepta('PDF de la anulada', () => app.service('api::billing.invoice-pdf').generar(borrador.documentId), (r) => Buffer.isBuffer(r.pdf) && r.pdf.subarray(0, 5).toString() === '%PDF-' && r.pdf.length > 2000);
  await acepta('los renglones de la anulada ya no retienen sus líneas', () => d(R).findMany({ filters: { invoice: { documentId: borrador.documentId } } }), (rs) =>
    rs.length === 2 && rs.every((r) => r.lockKey === null && !!r.sourceLineKey));
  await rechaza('una anulada no vuelve a emitida', () => d(F).update({ documentId: borrador.documentId, data: { state: 'issued' } }), 'no puede pasar');
  const reCobro = await acepta('la línea liberada se puede cobrar en otra factura', () => d(R).create({ data: renglonDe(otroBorrador, lineaServicio) }), (r) => r.lockKey === lineaServicio.lineKey);
  await acepta('borrar un borrador borra sus renglones y libera sus líneas', async () => {
    await d(F).delete({ documentId: otroBorrador.documentId });
    return d(R).findMany({ filters: { lockKey: lineaServicio.lineKey } });
  }, (rs) => rs.length === 0 && !!reCobro);

  await rechaza('factura con la suscripción de otro cliente', () => d(F).create({ data: { customer: cliente2.documentId, subscription: suscripcion.documentId } }), 'no es del cliente');
  await acepta('renglón de suscripción con su precio', async () => {
    const f = await d(F).create({ data: { customer: cliente.documentId, subscription: suscripcion.documentId } });
    return d(R).create({ data: { invoice: f.documentId, kind: 'subscription', subscription: suscripcion.documentId, unitPrice: 1000, taxTreatment: 'gravado', taxRate: 19 } });
  }, (r) => r.lineTotal === 1190 && r.lockKey === null);


  console.log('\n--- facturar desde la consulta ---');
  const facturasDelCliente = () => d(F).count({ filters: { customer: { documentId: cliente.documentId } } });

  await acepta('estado de la consulta: dos pendientes, una recomendada, y la factura anulada como antecedente',
    () => fact.estadoDeConsulta(consulta.documentId),
    (e) => {
      const [a, b, c] = e.lineas;
      return e.resumen === 'sin_facturar' && e.pendientes === 2 && e.valorPendiente === 178500 + 84000 &&
        a.estado === 'pendiente' && a.estimado?.lineTotal === 178500 && a.anteriores.length === 1 && a.anteriores[0].state === 'voided' &&
        b.estado === 'pendiente' && c.estado === 'no_facturable' && /recommended/.test(c.motivo) &&
        e.cliente?.documentId === cliente.documentId;
    });
  await acepta('la bandeja de pendientes incluye la consulta',
    () => fact.pendientes({ cliente: cliente.documentId }),
    (p) => p.length === 1 && p[0].consulta.documentId === consulta.documentId && p[0].pendientes === 2 && !('lineas' in p[0]));

  const antes = await facturasDelCliente();
  await rechaza('crear un borrador con una línea recomendada no deja nada a medias',
    () => fact.crearBorrador({ conceptos: [
      { consulta: consulta.documentId, lineKey: lineaServicio.lineKey },
      { consulta: consulta.documentId, lineKey: lineaRecomendada.lineKey },
    ] }),
    'no es facturable');
  await acepta('…ni factura ni renglones sueltos', () => facturasDelCliente(), (n) => n === antes);

  const desdeConsulta = await acepta('crear el borrador con las dos pendientes; el cliente sale de la consulta',
    () => fact.crearBorrador({ conceptos: [
      { consulta: consulta.documentId, lineKey: lineaServicio.lineKey },
      { consulta: consulta.documentId, lineKey: lineaMedicamento.lineKey, discountAmount: 2000 },
    ] }),
    (f) => f.state === 'draft' && f.items.length === 2 && f.items[0].sortOrder === 0 &&
      f.customer?.documentId === cliente.documentId && f.amount === 178500 + 84000 - 2000);
  await acepta('la consulta queda facturada y sale de la bandeja', async () => ({
    e: await fact.estadoDeConsulta(consulta.documentId),
    p: await fact.pendientes({ cliente: cliente.documentId }),
  }), ({ e, p }) => e.resumen === 'facturada' && e.lineas[0].factura?.documentId === desdeConsulta?.documentId && p.length === 0);
  await rechaza('volver a facturar lo mismo',
    () => fact.crearBorrador({ conceptos: [{ consulta: consulta.documentId, lineKey: lineaServicio.lineKey }] }),
    'ya se está cobrando');

  // --- la consulta no puede contradecir lo cobrado ---
  const lineasActuales = async (cambio) => {
    const c = await leer();
    return c.lines.map((l) => {
      const campo = l.__component === 'clinical.service-line' ? 'service' : 'product';
      const base = { __component: l.__component, id: l.id, [campo]: { connect: [], disconnect: [] }, quantity: Number(l.quantity), state: l.state, notes: l.notes };
      return cambio(base, l) ?? base;
    });
  };
  const guardar = async (cambio) => d('api::clinical.consultation').update({ documentId: consulta.documentId, data: { lines: await lineasActuales(cambio) } });

  await rechaza('cambiar la cantidad de una línea facturada',
    () => guardar((b, l) => (l.lineKey === lineaServicio.lineKey ? { ...b, quantity: 1 } : b)), 'cantidad');
  await rechaza('pasar a recomendada una línea facturada',
    () => guardar((b, l) => (l.lineKey === lineaServicio.lineKey ? { ...b, state: 'recommended' } : b)), 'no puede pasar');
  await rechaza('cambiar el producto de una línea facturada',
    () => guardar((b, l) => (l.lineKey === lineaMedicamento.lineKey ? { ...b, product: vacunaProducto.documentId } : b)), 'no puede cambiar de producto');
  await rechaza('quitar una línea facturada',
    async () => d('api::clinical.consultation').update({
      documentId: consulta.documentId,
      data: { lines: (await lineasActuales((b) => b)).filter((b, i) => i !== 1) },
    }), 'no se puede quitar');
  await acepta('las notas y el paso de entregado a aplicado sí se pueden cambiar',
    () => guardar((b, l) => (l.lineKey === lineaMedicamento.lineKey ? { ...b, state: 'applied', notes: 'Con comida' } : { ...b, notes: 'Revisado' })),
    (r) => !!r);
  await rechaza('archivar una consulta facturada',
    () => d('api::clinical.consultation').update({ documentId: consulta.documentId, data: { archivedAt: new Date().toISOString() } }), 'archivarse');
  await rechaza('borrar una consulta facturada',
    () => d('api::clinical.consultation').delete({ documentId: consulta.documentId }), 'no se puede borrar');
  await rechaza('archivar un borrador con renglones',
    () => d(F).update({ documentId: desdeConsulta.documentId, data: { archivedAt: new Date().toISOString() } }), 'bórralo');

  await acepta('borrar el borrador devuelve las líneas a pendientes', async () => {
    await d(F).delete({ documentId: desdeConsulta.documentId });
    return fact.estadoDeConsulta(consulta.documentId);
  }, (e) => e.resumen === 'sin_facturar' && e.pendientes === 2);
  await acepta('y entonces la línea ya se puede cambiar',
    () => guardar((b, l) => (l.lineKey === lineaServicio.lineKey ? { ...b, quantity: 1 } : b)), (r) => !!r);

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

  console.log('\n--- emisión y consecutivo ---');
  const nuevaConCargo = async () => {
    const f = await d(F).create({ data: { customer: cliente.documentId } });
    await d(R).create({ data: { invoice: f.documentId, kind: 'custom', description: 'Cargo SMOKE', unitPrice: 1000, taxTreatment: 'excluido' } });
    return f;
  };
  const antesDeLaSegunda = await consecutivo();
  await acepta('dos emisiones seguidas toman números consecutivos', async () => {
    const a = await fact.emitir((await nuevaConCargo()).documentId);
    const b = await fact.emitir((await nuevaConCargo()).documentId);
    return [Number(a.number), Number(b.number)];
  }, ([a, b]) => a === antesDeLaSegunda + 1 && b === antesDeLaSegunda + 2);

  // Clínica: el formulario reenvía las resoluciones tal como estaban al abrirlo.
  const reenviar = async (cambio) => {
    const c = await d('api::clinic.clinic').findFirst({ populate: ['resolutions'] });
    const resoluciones = c.resolutions.map((r) => cambio({ ...r })).filter(Boolean);
    return app.service('api::clinic.clinic').createOrUpdate({ data: { resolutions: resoluciones } });
  };
  const antesDeGuardar = await consecutivo();
  await acepta('guardar Clínica con un consecutivo viejo no lo hace retroceder', async () => {
    await reenviar((r) => (r.id === resolucion.id ? { ...r, currentNumber: 1 } : r));
    return consecutivo();
  }, (n) => n === antesDeGuardar);
  await rechaza('cambiar el prefijo de una resolución ya usada',
    () => reenviar((r) => (r.id === resolucion.id ? { ...r, prefix: 'ZZ' } : r)), 'no se puede cambiar');
  await rechaza('quitar una resolución ya usada',
    () => reenviar((r) => (r.id === resolucion.id ? null : r)), 'no se puede quitar');

  await app.db.connection(TABLA_RES).where({ id: resolucion.id }).update({ current_number: resolucion.rangeTo });
  const agotada = await nuevaConCargo();
  await rechaza('emitir con el rango agotado', () => fact.emitir(agotada.documentId), 'agotó su rango');
  await acepta('…y la factura sigue en borrador', () => d(F).findOne({ documentId: agotada.documentId }), (r) => r.state === 'draft' && !r.number);

  await restaurarConsecutivo();

  console.log('\n--- limpieza ---');
  console.log(`  ${await limpiar(app)} registros de prueba eliminados`);

  console.log(`\n=========  ${pass} correctas, ${fail} fallidas  =========`);
  await app.destroy();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('la prueba de humo no pudo ejecutarse:', e);
  process.exit(2);
});
