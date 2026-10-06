'use strict';

/**
 * Caja de muestra (sección 5.7 del documento de modelo).
 *
 *   - Cajas "Caja recepción" (la abre cualquiera con permiso) y "Caja 2"
 *     (solo su responsable autorizada).
 *   - Cuenta del panel del rol "Caja": diana.vargas@veterinaria.test
 *     (contraseña de demo del staff).
 *   - Turno de ayer en Caja recepción (Andrés, de Recepción): cobra la factura
 *     pagada de demo-facturas.js y cierra con un descuadre de $ 2.000
 *     explicado.
 *   - Turno de hoy en Caja 2 (Diana), abierto: una venta de mostrador a
 *     consumidor final en efectivo con cambio, una venta con tarjeta, una a
 *     crédito con abono por Nequi (queda en cartera), un anticipo y un retiro.
 *
 * Escribe sin sesión del panel: el responsable del turno lo pone este script.
 * No se ejecuta suelto: lo usa demo-data.js en dos pasos (`abrirCajas` antes
 * de las facturas, `completarCaja` después) y `borrarCaja` antes que
 * `borrarFacturas`.
 */

const { cuentaDelPanel, borrarCuentaDelPanel } = require('./demo-staff');

const CJ = 'api::cash.cash-register';
const T = 'api::cash.cash-session';
const P = 'api::cash.payment';
const M = 'api::cash.cash-movement';

const MARCA = 'Venta de muestra (demo-caja.js)';
const CAJAS = ['Caja recepción', 'Caja 2'];

const CAJERA = {
  email: 'diana.vargas@veterinaria.test',
  rol: 'Caja',
  perfil: {
    firstName: 'Diana', lastName: 'Vargas', documentType: 'cc',
    documentNumber: '1152447890', occupation: 'Cajera', gender: 'female',
  },
};
const RECEPCION = 'andres.mejia@veterinaria.test';

const HORA = 3600_000;
/** Ayer a esa hora local (la de este equipo), como instante. */
const ayerA = (h) => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

const conteo = (pares) => pares.map(([denomination, quantity]) => ({ denomination, quantity, kind: denomination >= 2000 ? 'bill' : 'coin' }));

/**
 * Billetes y monedas que suman `total`, de mayor a menor (para el arqueo).
 * Las monedas de 50 son las más pequeñas: lo que no cuadre a 50, se pierde.
 */
function desglose(total) {
  const pares = [];
  let resto = total;
  for (const d of [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50]) {
    const q = Math.floor(resto / d);
    if (q > 0) pares.push([d, q]);
    resto -= q * d;
  }
  return conteo(pares);
}

async function abrirCajas(app, { password }) {
  const d = (uid) => app.documents(uid);
  const diana = await cuentaDelPanel(app, { ...CAJERA, password });
  const andres = await app.db.query('admin::user').findOne({ where: { email: RECEPCION } });
  if (!andres) throw new Error(`Falta la cuenta ${RECEPCION} (la crea demo-horarios.js)`);

  let recepcion = await d(CJ).findFirst({ filters: { name: CAJAS[0] } });
  if (!recepcion) recepcion = await d(CJ).create({ data: { name: CAJAS[0], location: 'Mostrador de recepción', defaultOpeningFloat: 200000, isActive: true } });
  let caja2 = await d(CJ).findFirst({ filters: { name: CAJAS[1] } });
  if (!caja2) {
    caja2 = await d(CJ).create({
      data: { name: CAJAS[1], location: 'Tienda (alimentos y accesorios)', defaultOpeningFloat: 150000, operators: [diana.documentId], isActive: true },
    });
  }

  const yaHay = await d(T).count({ filters: { register: { documentId: { $in: [recepcion.documentId, caja2.documentId] } } } });
  if (yaHay > 0) return { creada: false, cajera: CAJERA.email };

  const ayer = await d(T).create({
    data: { register: recepcion.documentId, responsible: andres.documentId, openedAt: ayerA(8), openingCount: desglose(200000) },
  });
  return { creada: true, cajera: CAJERA.email, ayer: ayer.documentId, pagadaEl: ayerA(10), recepcion, caja2, diana };
}

async function completarCaja(app, ctx) {
  if (!ctx.creada) return { creada: false, cajera: ctx.cajera };
  const d = (uid) => app.documents(uid);
  const pos = app.service('api::cash.pos');

  // --- ayer: un anticipo y el cierre con $ 2.000 de faltante ---------------
  const luz = await d('api::customer.customer').findFirst({ filters: { profile: { documentNumber: '402219' } } });
  if (luz) {
    await d(P).create({
      data: { kind: 'payment', purpose: 'advance', customer: luz.documentId, method: 'cash', amount: 50000, session: ctx.ayer, paidAt: ayerA(11), notes: 'Anticipo para la esterilización de Simón' },
    });
  }
  await d(M).create({ data: { session: ctx.ayer, kind: 'expense', amount: 18000, concept: 'Domicilio de medicamentos', reference: 'Recibo 0042', occurredAt: ayerA(15) } });
  const resumenAyer = await pos.resumen(ctx.ayer);
  await pos.cerrar(ctx.ayer, { conteo: desglose(resumenAyer.esperado - 2000), motivo: 'Faltan $ 2.000: cambio mal dado en una venta de la tarde (revisado con la administración)' });

  // --- hoy: Diana en Caja 2, turno abierto ----------------------------------
  const hoy = await d(T).create({ data: { register: ctx.caja2.documentId, responsible: ctx.diana.documentId, openingCount: desglose(150000) } });
  const producto = async (nombre) => d('api::catalog.product').findFirst({ filters: { name: nombre } });
  const [pelota, omega, champu, collar] = await Promise.all(['Pelota de caucho macizo', 'Omega 3 para perros', 'Champú hidratante', 'Collar isabelino'].map(producto));
  const renglon = (p, cantidad = 1) => ({ tipo: 'catalogo', relacion: 'product', documentId: p.documentId, cantidad });
  const cliente = async (doc) => d('api::customer.customer').findFirst({ filters: { profile: { documentNumber: doc } } });
  const [maria, carlos] = await Promise.all([cliente('1017254398'), cliente('71654890')]);
  const ventas = [];

  // Consumidor final, en efectivo con cambio.
  if (pelota && omega) {
    const items = [renglon(pelota, 2), renglon(omega)];
    const total = await totalDe(app, items);
    ventas.push(await pos.cobrar({
      turno: hoy.documentId, renglones: items, notas: MARCA,
      pagos: [{ medio: 'cash', valor: total, recibido: Math.ceil(total / 50000) * 50000 }],
    }));
  }
  // Carlos, con tarjeta débito.
  if (carlos && champu) {
    const total = await totalDe(app, [renglon(champu)]);
    ventas.push(await pos.cobrar({
      turno: hoy.documentId, cliente: carlos.documentId, renglones: [renglon(champu)], notas: MARCA,
      pagos: [{ medio: 'card', valor: total, tipoTarjeta: 'debit', franquicia: 'Visa', ultimos4: '4417', aprobacion: '083215' }],
    }));
  }
  // María, a crédito: abona la mitad por Nequi y el resto queda en cartera.
  if (maria && collar && omega) {
    const items = [renglon(collar), renglon(omega, 2)];
    const total = await totalDe(app, items);
    ventas.push(await pos.cobrar({
      turno: hoy.documentId, cliente: maria.documentId, renglones: items, notas: MARCA,
      vence: new Date(Date.now() + 15 * 24 * HORA).toISOString().slice(0, 10),
      pagos: [{ medio: 'transfer', valor: Math.round(total / 2), canal: 'nequi', referencia: 'M48213377' }],
    }));
  }
  await pos.movimiento({ turno: hoy.documentId, tipo: 'withdrawal', valor: 100000, concepto: 'Sangría: a la caja fuerte' });

  const resumenHoy = await pos.resumen(hoy.documentId);
  return { creada: true, cajera: CAJERA.email, ventas: ventas.length, esperadoHoy: resumenHoy.esperado };
}

/** Total con IVA de unos renglones de catálogo, con los precios de hoy. */
async function totalDe(app, renglones) {
  let total = 0;
  for (const r of renglones) {
    const p = await app.documents('api::catalog.product').findOne({ documentId: r.documentId, populate: ['tax'] });
    const base = Number(p.salePrice) * Number(r.cantidad ?? 1);
    total += p.tax?.ivaTreatment === 'gravado' ? Math.round(base * (1 + Number(p.tax.ivaRate) / 100)) : base;
  }
  return total;
}

async function borrarCaja(app) {
  const d = (uid) => app.documents(uid);
  let n = 0;
  const cajas = await app.db.query(CJ).findMany({ where: { name: { $in: CAJAS } }, select: ['id', 'documentId'] });
  const turnos = await app.db.query(T).findMany({ where: { register: { id: { $in: cajas.map((c) => c.id) } } }, select: ['id', 'documentId'] });
  const idsTurnos = turnos.map((t) => t.id);

  // Ventas de muestra: sus pagos, renglones y la factura (por el query engine: una emitida no se borra).
  const facturas = await app.db.query('api::billing.invoice').findMany({ where: { notes: { $startsWith: MARCA } }, select: ['id'] });
  const idsFacturas = facturas.map((f) => f.id);
  n += (await app.db.query(P).deleteMany({
    where: { $or: [{ session: { id: { $in: idsTurnos } } }, { invoice: { id: { $in: idsFacturas } } }] },
  })).count;
  if (idsFacturas.length > 0) {
    n += (await app.db.query('api::billing.invoice-item').deleteMany({ where: { invoice: { id: { $in: idsFacturas } } } })).count;
    n += (await app.db.query('api::billing.invoice').deleteMany({ where: { id: { $in: idsFacturas } } })).count;
  }
  n += (await app.db.query(M).deleteMany({ where: { session: { id: { $in: idsTurnos } } } })).count;
  for (const t of turnos) {
    await d(T).delete({ documentId: t.documentId });
    n++;
  }
  for (const c of cajas) {
    await d(CJ).delete({ documentId: c.documentId });
    n++;
  }
  n += await borrarCuentaDelPanel(app, { email: CAJERA.email, documentNumber: CAJERA.perfil.documentNumber });
  return n;
}

module.exports = { abrirCajas, completarCaja, borrarCaja, CAJERA, desglose };
