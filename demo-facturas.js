'use strict';

/**
 * Facturas de muestra sobre la historia de Kira, y la cuenta del panel de la
 * administración (la única que puede anular).
 *
 *   emitida y pagada   la primera consulta
 *   anulada            la segunda: sus conceptos vuelven a quedar pendientes,
 *                      con la anulada como antecedente
 *   borrador           la tercera
 *
 * Cobra todas las líneas cobrables de cada consulta: servicios (gravados al
 * 19 %, ver `IVA_SERVICIOS` en demo-clinica.js) y productos.
 *
 * Emitir consume números de la resolución de la demo. Al borrar se devuelve
 * el consecutivo a donde estaba, salvo que después se haya emitido otra
 * factura (entonces no se puede retroceder sin repetir números).
 *
 * No se ejecuta suelto: lo usa demo-data.js.
 */

const { cuentaDelPanel, borrarCuentaDelPanel } = require('./demo-staff');

const MARCA = 'Factura de muestra (demo-facturas.js)';
const ADMINISTRACION = {
  email: 'marta.lozano@veterinaria.test',
  rol: 'Administrador de clínica',
  perfil: {
    firstName: 'Marta', lastName: 'Lozano', documentType: 'cc',
    documentNumber: '52847193', occupation: 'Administradora de la clínica', gender: 'female',
  },
};

async function crearFacturas(app, { password, turno, pagadaEl }) {
  await cuentaDelPanel(app, { ...ADMINISTRACION, password });

  const existentes = await app.documents('api::billing.invoice').findMany({
    filters: { notes: { $startsWith: MARCA }, $or: [{ archivedAt: { $null: true } }, { archivedAt: { $notNull: true } }] },
  });
  if (existentes.length > 0) return { creadas: 0, admin: ADMINISTRACION.email };

  const kira = await app.documents('api::pet.pet').findFirst({ filters: { name: 'Kira' } });
  if (!kira) throw new Error('Falta Kira: las facturas de muestra salen de su historia');
  const consultas = await app.documents('api::clinical.consultation').findMany({
    filters: { pet: { documentId: kira.documentId } },
    sort: 'consultedAt:asc',
  });

  const fact = app.service('api::billing.invoicing');
  // Por cada consulta, sus líneas que hoy se pueden cobrar.
  const cobrables = [];
  for (const c of consultas) {
    const e = await fact.estadoDeConsulta(c.documentId);
    const lineas = e.lineas.filter((l) => l.estado === 'pendiente' && !l.estimado?.problema);
    if (lineas.length > 0) cobrables.push({ consulta: c.documentId, lineas });
  }
  if (cobrables.length < 3) {
    throw new Error(`La historia de Kira tiene ${cobrables.length} consultas con productos cobrables; hacen falta 3`);
  }

  const borrador = (i, nota) =>
    fact.crearBorrador({
      conceptos: cobrables[i].lineas.map((l) => ({ consulta: cobrables[i].consulta, lineKey: l.lineKey })),
      notas: `${MARCA}. ${nota}`,
    });

  const pagada = await borrador(0, 'Emitida y pagada.');
  const emitida = await fact.emitir(pagada.documentId);
  // Se paga en la caja (5.7): el estado de pago lo calcula el servidor.
  if (!turno) throw new Error('La factura pagada se cobra en un turno de caja (demo-caja.js)');
  await app.documents('api::cash.payment').create({
    data: {
      kind: 'payment', purpose: 'invoice', invoice: pagada.documentId, method: 'cash',
      amount: Number(emitida.amount), receivedAmount: Math.ceil(Number(emitida.amount) / 50000) * 50000,
      session: turno, paidAt: pagadaEl ?? new Date().toISOString(),
    },
  });

  const anulada = await borrador(1, 'Emitida y anulada.');
  const emitidaAnulada = await fact.emitir(anulada.documentId);
  await app.documents('api::billing.invoice').update({
    documentId: anulada.documentId,
    data: { state: 'voided', voidReason: 'Se emitió a nombre equivocado (muestra)' },
  });

  await borrador(2, 'Borrador sin emitir.');

  return {
    creadas: 3,
    admin: ADMINISTRACION.email,
    numeros: [emitida.fullNumber, emitidaAnulada.fullNumber],
  };
}

async function borrarFacturas(app) {
  // Por el query engine: una emitida o anulada no se borra por el Document
  // Service (se anula), y es justo lo que la regla debe impedir en uso real.
  const facturas = await app.db.query('api::billing.invoice').findMany({
    where: { notes: { $startsWith: MARCA } },
    select: ['id', 'number', 'resolutionNumber'],
  });
  let n = 0;
  if (facturas.length > 0) {
    const ids = facturas.map((f) => f.id);
    // Sus pagos primero (no se borran por el Document Service).
    n += (await app.db.query('api::cash.payment').deleteMany({ where: { invoice: { id: { $in: ids } } } })).count;
    n += (await app.db.query('api::billing.invoice-item').deleteMany({ where: { invoice: { id: { $in: ids } } } })).count;
    n += (await app.db.query('api::billing.invoice').deleteMany({ where: { id: { $in: ids } } })).count;
  }

  // Devolver el consecutivo solo si lo último emitido fue de la muestra.
  const tabla = app.db.metadata.get('billing.dian-resolution').tableName;
  const porResolucion = new Map();
  for (const f of facturas.filter((x) => x.number != null)) {
    const nums = porResolucion.get(f.resolutionNumber) ?? [];
    nums.push(Number(f.number));
    porResolucion.set(f.resolutionNumber, nums);
  }
  for (const [resolucion, numeros] of porResolucion) {
    const fila = await app.db.connection(tabla).where({ resolution_number: resolucion }).first('id', 'current_number');
    if (!fila || Number(fila.current_number) !== Math.max(...numeros)) continue;
    const restantes = await app.db.query('api::billing.invoice').findMany({
      where: { resolutionNumber: resolucion, number: { $notNull: true } },
      select: ['number'],
    });
    const nuevo = Math.max(Math.min(...numeros) - 1, ...restantes.map((r) => Number(r.number)));
    await app.db.connection(tabla).where({ id: fila.id }).update({ current_number: nuevo });
  }

  n += await borrarCuentaDelPanel(app, { email: ADMINISTRACION.email, documentNumber: ADMINISTRACION.perfil.documentNumber });
  return n;
}

module.exports = { crearFacturas, borrarFacturas, ADMINISTRACION };
