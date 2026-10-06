import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  effective,
  effectiveRelation,
  esDiferenciaVacia,
  loadCurrent,
  on,
  toDocumentId,
} from './helpers';
import { includeArchived } from './archived';
import { cuentaDelPanel } from './actor';
import {
  efectivoEsperado,
  estadoDePago,
  pagadoDeFactura,
  saldoAFavor,
  totalDelConteo,
  totalesDelTurno,
} from '../api/cash/domain/caja';

/**
 * Caja y pagos (sección 5.7 del documento de modelo).
 *
 * Como en el resto del modelo, las reglas viven en el Document Service: el
 * punto de venta, el Content Manager y cualquier integración escriben por
 * aquí. El servicio `api::cash.pos` orquesta; esto decide.
 */

const CAJA = 'api::cash.cash-register';
const TURNO = 'api::cash.cash-session';
const PAGO = 'api::cash.payment';
const MOVIMIENTO = 'api::cash.cash-movement';
const FACTURA = 'api::billing.invoice';

const PERMISO = 'plugin::veterinaria-caja.caja.';

/** ¿La petición en curso es de una cuenta del panel con ese permiso de caja? Sin sesión (scripts), sí. */
function puede(strapi: Core.Strapi, accion: string): boolean {
  const state = strapi.requestContext.get()?.state;
  if (!state?.user || state?.auth?.strategy?.name !== 'admin') return true;
  return Boolean(state.userAbility?.can(`${PERMISO}${accion}`));
}

const peso = (n: number): string => `$ ${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

const sinIds = (v: any): any => JSON.parse(JSON.stringify(v ?? null, (k, x) => (k === 'id' || k === '__component' ? undefined : x)));

/** ¿El campo cambia frente a lo guardado? El Content Manager reenvía el formulario entero. */
function cambia(campo: string, valor: any, actual: any): boolean {
  if (valor === undefined) return false;
  const guardado = actual?.[campo];
  if (valor && typeof valor === 'object' && !Array.isArray(valor) && (valor.connect || valor.disconnect || valor.set)) {
    if (esDiferenciaVacia(valor)) return false;
    return (toDocumentId(valor) ?? null) !== (guardado?.documentId ?? null);
  }
  if (Array.isArray(valor) || (valor && typeof valor === 'object')) {
    return JSON.stringify(sinIds(valor)) !== JSON.stringify(sinIds(guardado));
  }
  const a = valor === '' ? null : valor;
  const b = guardado === undefined || guardado === '' ? null : guardado;
  if (a === b) return false;
  if (typeof a === 'string' && typeof b === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(a) && Date.parse(a) === Date.parse(b)) return false;
  return String(a) !== String(b);
}

/** Pagos (sin reversados) de un filtro, en la forma que usa el dominio. */
async function pagosDe(strapi: Core.Strapi, where: any): Promise<any[]> {
  return strapi.db.query(PAGO as any).findMany({
    where: { ...where, state: 'posted' },
    select: ['kind', 'purpose', 'method', 'amount', 'state'],
  });
}

const movimientosDe = (strapi: Core.Strapi, turnoId: string): Promise<any[]> =>
  strapi.db.query(MOVIMIENTO as any).findMany({ where: { session: { documentId: turnoId } }, select: ['kind', 'amount'] });

/** Efectivo esperado de un turno, con lo que haya guardado ahora mismo. */
export async function efectivoDelTurno(strapi: Core.Strapi, turno: { documentId: string; openingFloat?: number }): Promise<number> {
  const [pagos, movimientos] = await Promise.all([
    pagosDe(strapi, { session: { documentId: turno.documentId } }),
    movimientosDe(strapi, turno.documentId),
  ]);
  return efectivoEsperado(Number(turno.openingFloat ?? 0), pagos, movimientos);
}

/** Saldo a favor de un cliente (C9). */
export async function saldoDelCliente(strapi: Core.Strapi, clienteId: string): Promise<number> {
  return saldoAFavor(await pagosDe(strapi, { customer: { documentId: clienteId } }));
}

/**
 * Recalcula y guarda `paidAmount` y `paymentState` de una factura a partir de
 * sus pagos (C8). Con el query engine, como `recalcularFactura`: la regla de
 * la factura rechaza cualquier cambio de estos campos por el Document Service.
 */
export async function recalcularPagos(strapi: Core.Strapi, facturaId: string): Promise<{ pagado: number; estado: string }> {
  const factura: any = await strapi.db.query(FACTURA as any).findOne({ where: { documentId: facturaId }, select: ['amount'] });
  if (!factura) return { pagado: 0, estado: 'unpaid' };
  const pagado = pagadoDeFactura(await pagosDe(strapi, { invoice: { documentId: facturaId } }));
  const estado = estadoDePago(pagado, Number(factura.amount));
  await strapi.db.query(FACTURA as any).update({ where: { documentId: facturaId }, data: { paidAmount: pagado, paymentState: estado } });
  return { pagado, estado };
}

const etiquetaTurno = (t: any) => `${t?.register?.name ?? 'la caja'} (abierto ${String(t?.openedAt ?? '').slice(0, 16).replace('T', ' ')})`;

export default (strapi: Core.Strapi): void => {
  // ---- api::cash.cash-register ----------------------------------------------

  on(strapi, CAJA, ['update', 'delete'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const id = ctx.params.documentId;
    const abierto = await strapi.documents(TURNO as any).findFirst({ filters: { register: { documentId: id }, state: 'open' } as any } as any);
    if (ctx.action === 'delete') {
      if (abierto) throw new ValidationError('La caja tiene un turno abierto: ciérralo antes');
      const turnos = await strapi.documents(TURNO as any).count({ filters: { register: { documentId: id } } as any } as any);
      if (turnos > 0) throw new ValidationError('La caja ya tiene turnos: desactívala en vez de borrarla');
    } else if (data.isActive === false && abierto) {
      throw new ValidationError('La caja tiene un turno abierto: ciérralo antes de desactivarla');
    }
    return next();
  });

  // ---- api::cash.cash-session -----------------------------------------------

  on(strapi, TURNO, ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const actual = await loadCurrent(strapi, ctx, { register: true, responsible: true, closingCount: true, openingCount: true });

    // Lo calcula el servidor.
    for (const k of ['countedCash', 'expectedCash', 'difference', 'totals', 'closedAt', 'closedBy']) delete data[k];

    if (ctx.action === 'update' && actual?.state === 'closed') {
      const tocados = Object.keys(data).filter((k) => k !== 'searchLabel' && cambia(k, data[k], actual));
      if (tocados.length > 0) throw new ValidationError(`El turno de ${etiquetaTurno(actual)} ya se cerró: no cambia (${tocados.join(', ')})`);
      ctx.params.data = data;
      return next();
    }

    const estado = effective<string>(data, actual, 'state') ?? 'open';

    if (ctx.action === 'create') {
      if (estado !== 'open') throw new ValidationError('Un turno nace abierto; se cierra con el arqueo');
      const cajaId = effectiveRelation(data, actual, 'register');
      if (!cajaId) return next(); // required-relations
      const caja: any = await strapi.documents(CAJA as any).findOne({ documentId: cajaId, populate: { operators: { fields: ['documentId'] } } as any } as any);
      if (!caja) throw new ValidationError('La caja indicada no existe');
      if (caja.isActive === false) throw new ValidationError(`La caja "${caja.name}" está desactivada`);

      const cuenta = await cuentaDelPanel(strapi);
      if (cuenta) data.responsible = cuenta;
      const responsable = cuenta ?? effectiveRelation(data, actual, 'responsible');
      if (!responsable) throw new ValidationError('El turno necesita un responsable');

      const operadores = (caja.operators ?? []).map((o: any) => o.documentId);
      if (operadores.length > 0 && !operadores.includes(responsable)) {
        throw new ValidationError(`No estás autorizado para abrir "${caja.name}": pide a la administración que te añada a sus responsables`);
      }
      const enLaCaja = await strapi.documents(TURNO as any).findFirst({
        filters: { register: { documentId: cajaId }, state: 'open' } as any,
        populate: { responsible: { fields: ['firstname', 'lastname'] } } as any,
      } as any);
      if (enLaCaja) {
        const quien = [enLaCaja.responsible?.firstname, enLaCaja.responsible?.lastname].filter(Boolean).join(' ');
        throw new ValidationError(`"${caja.name}" ya tiene un turno abierto${quien ? ` por ${quien}` : ''}`);
      }
      const propio = await strapi.documents(TURNO as any).findFirst({
        filters: { responsible: { documentId: responsable }, state: 'open' } as any,
        populate: { register: { fields: ['name'] } } as any,
      } as any);
      if (propio) throw new ValidationError(`Ya tienes un turno abierto en "${propio.register?.name}": ciérralo antes de abrir otra caja`);

      if (data.openingFloat === undefined || data.openingFloat === null) {
        data.openingFloat = Array.isArray(data.openingCount) && data.openingCount.length > 0
          ? totalDelConteo(data.openingCount)
          : Number(caja.defaultOpeningFloat ?? 0);
      }
      if (Number(data.openingFloat) < 0) throw new ValidationError('La base no puede ser negativa');
      if (!data.openedAt) data.openedAt = new Date().toISOString();
      ctx.params.data = data;
      return next();
    }

    // --- abierto: cerrar o anotar ---
    for (const k of ['register', 'responsible', 'openingFloat', 'openingCount', 'openedAt']) {
      if (k in data && cambia(k, data[k], actual)) throw new ValidationError(`${k} se fija al abrir el turno y no cambia`);
    }

    if (estado === 'closed') {
      const conteo = data.closingCount ?? actual?.closingCount;
      if (!Array.isArray(conteo) || conteo.length === 0) throw new ValidationError('Para cerrar la caja hay que contar el efectivo (closingCount)');
      const contado = totalDelConteo(conteo);
      const [pagos, movimientos] = await Promise.all([
        pagosDe(strapi, { session: { documentId: ctx.params.documentId } }),
        movimientosDe(strapi, ctx.params.documentId),
      ]);
      const totales = totalesDelTurno(Number(actual?.openingFloat ?? 0), pagos, movimientos);
      const diferencia = contado - totales.efectivoEsperado;
      if (diferencia !== 0 && !String(effective(data, actual, 'differenceReason') ?? '').trim()) {
        throw new ValidationError(
          `Hay un descuadre de ${peso(diferencia)} (contado ${peso(contado)}, esperado ${peso(totales.efectivoEsperado)}): explica el motivo para cerrar`
        );
      }
      // Solo puede cerrar el turno de otro quien supervisa.
      const cuenta = await cuentaDelPanel(strapi);
      if (cuenta && actual?.responsible?.documentId && cuenta !== actual.responsible.documentId && !puede(strapi, 'supervisar')) {
        throw new ValidationError('Solo el responsable del turno (o quien supervisa la caja) puede cerrarlo');
      }
      Object.assign(data, {
        countedCash: contado,
        expectedCash: totales.efectivoEsperado,
        difference: diferencia,
        totals: totales,
        closedAt: new Date().toISOString(),
        ...(cuenta ? { closedBy: cuenta } : {}),
      });
    }
    ctx.params.data = data;
    return next();
  });

  on(strapi, TURNO, ['delete'], async (ctx, next) => {
    const id = ctx.params.documentId;
    const [pagos, movimientos] = await Promise.all([
      strapi.documents(PAGO as any).count({ filters: { session: { documentId: id } } as any } as any),
      strapi.documents(MOVIMIENTO as any).count({ filters: { session: { documentId: id } } as any } as any),
    ]);
    if (pagos + movimientos > 0) throw new ValidationError('El turno tiene pagos o movimientos: no se borra');
    return next();
  });

  /** Turno abierto donde se escribe, comprobando que la cuenta pueda usarlo. */
  async function exigirTurnoAbierto(turnoId: string | null | undefined): Promise<any> {
    if (!turnoId) throw new ValidationError('Todo dinero entra o sale por una caja: indica el turno (session)');
    const turno: any = await strapi.documents(TURNO as any).findOne({
      documentId: turnoId,
      populate: { register: { fields: ['name'] }, responsible: { fields: ['documentId'] } } as any,
    } as any);
    if (!turno) throw new ValidationError('El turno indicado no existe');
    if (turno.state !== 'open') throw new ValidationError(`El turno de ${etiquetaTurno(turno)} ya se cerró`);
    const cuenta = await cuentaDelPanel(strapi);
    if (cuenta && turno.responsible?.documentId !== cuenta && !puede(strapi, 'supervisar')) {
      throw new ValidationError('Ese turno es de otra persona: registra en tu propia caja');
    }
    return turno;
  }

  // ---- api::cash.payment ----------------------------------------------------

  on(strapi, PAGO, ['delete'], async () => {
    throw new ValidationError('Un pago no se borra: se reversa con motivo (mientras su turno siga abierto) o se devuelve');
  });

  on(strapi, PAGO, ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};

    if (ctx.action === 'update') {
      const actual = await loadCurrent(strapi, ctx, { session: true, invoice: true, customer: true });
      const tocados = Object.keys(data).filter((k) => k !== 'searchLabel' && cambia(k, data[k], actual));
      const reversa = actual?.state === 'posted' && data.state === 'reversed';
      const permitidos = reversa ? ['state', 'reversalReason', 'reversedAt', 'notes'] : ['notes'];
      const prohibidos = tocados.filter((k) => !permitidos.includes(k));
      if (prohibidos.length > 0) {
        throw new ValidationError(`Un pago no se edita (${prohibidos.join(', ')}): se reversa con motivo o se registra una devolución`);
      }
      if (reversa) {
        if (!String(data.reversalReason ?? '').trim()) throw new ValidationError('Para reversar un pago hay que indicar el motivo');
        if (actual?.method !== 'other') await exigirTurnoAbierto(actual?.session?.documentId);
        if (actual?.method === 'credit_balance' || actual?.purpose === 'advance' || (actual?.kind === 'refund' && actual?.method === 'credit_balance')) {
          // Reversar un anticipo no puede dejar el saldo a favor en negativo.
          const saldo = await saldoDelCliente(strapi, actual.customer?.documentId);
          const efecto = saldoAFavor([{ ...actual, state: 'posted' }]);
          if (saldo - efecto < 0) throw new ValidationError('Ese saldo a favor ya se usó: no se puede reversar el anticipo');
        }
        data.reversedAt = new Date().toISOString();
      }
      ctx.params.data = data;
      const resultado = await next();
      if (actual?.invoice?.documentId) await recalcularPagos(strapi, actual.invoice.documentId);
      return resultado;
    }

    // --- create ---
    const kind = data.kind ?? 'payment';
    const purpose = data.purpose ?? 'invoice';
    const method = data.method;
    const amount = Number(data.amount);
    if (!Number.isInteger(amount) || amount <= 0) throw new ValidationError('El valor del pago debe ser un entero mayor que cero');
    if (data.state && data.state !== 'posted') throw new ValidationError('Un pago nace registrado; se reversa después');

    // Migración (C2): `other` solo sin sesión del panel.
    let turno: any = null;
    if (method === 'other') {
      if (await cuentaDelPanel(strapi)) throw new ValidationError('El medio "other" solo existe para pagos migrados');
    } else {
      turno = await exigirTurnoAbierto(toDocumentId(data.session));
      data.session = turno.documentId;
    }

    if (kind === 'refund' && !puede(strapi, 'devolver')) {
      throw new ValidationError('Devolver dinero requiere el permiso "Devoluciones" de la caja');
    }

    // --- factura o anticipo ---
    const facturaId = toDocumentId(data.invoice);
    let factura: any = null;
    if (purpose === 'invoice') {
      if (!facturaId) throw new ValidationError('Indica la factura que se paga (o marca el pago como anticipo)');
      factura = await strapi.documents(FACTURA as any).findOne({
        documentId: facturaId,
        populate: { customer: { fields: ['documentId'] } } as any,
        filters: includeArchived(FACTURA) as any,
      } as any);
      if (!factura) throw new ValidationError('La factura indicada no existe');
      if (!['issued', 'dian_error'].includes(factura.state)) {
        throw new ValidationError(
          factura.state === 'draft' ? 'Un borrador no se cobra: se emite al cobrar' : `La factura ${factura.fullNumber ?? ''} está anulada: no admite pagos`
        );
      }
      const clienteId = toDocumentId(data.customer);
      if (clienteId && clienteId !== factura.customer?.documentId) throw new ValidationError('El pago es de otro cliente que el de la factura');
      data.customer = factura.customer?.documentId;

      const pagado = pagadoDeFactura(await pagosDe(strapi, { invoice: { documentId: facturaId } }));
      if (kind === 'payment' && pagado + amount > Number(factura.amount)) {
        throw new ValidationError(
          `La factura ${factura.fullNumber} tiene un saldo de ${peso(Number(factura.amount) - pagado)}: no se le puede abonar ${peso(amount)}`
        );
      }
      if (kind === 'refund' && amount > pagado) {
        throw new ValidationError(`De la factura ${factura.fullNumber} se ha cobrado ${peso(pagado)}: no se puede devolver ${peso(amount)}`);
      }
    } else {
      if (facturaId) throw new ValidationError('Un anticipo no lleva factura: se usa después como saldo a favor');
      if (!toDocumentId(data.customer)) throw new ValidationError('Un anticipo es de un cliente: indícalo');
      if (method === 'credit_balance') throw new ValidationError('Un anticipo no se paga con saldo a favor');
      if (kind === 'refund') {
        const saldo = await saldoDelCliente(strapi, toDocumentId(data.customer) as string);
        if (amount > saldo) throw new ValidationError(`El cliente tiene ${peso(saldo)} a favor: no se le pueden devolver ${peso(amount)}`);
      }
    }

    // --- medio ---
    data.changeAmount = 0;
    if (method === 'cash') {
      if (kind === 'payment') {
        const recibido = data.receivedAmount === undefined || data.receivedAmount === null ? amount : Number(data.receivedAmount);
        if (recibido < amount) throw new ValidationError(`Se recibieron ${peso(recibido)}: no alcanzan para ${peso(amount)}`);
        data.receivedAmount = recibido;
        data.changeAmount = recibido - amount;
      } else {
        delete data.receivedAmount;
        const disponible = await efectivoDelTurno(strapi, turno);
        if (amount > disponible) throw new ValidationError(`En la caja hay ${peso(disponible)} en efectivo: no alcanza para devolver ${peso(amount)}`);
      }
    } else {
      delete data.receivedAmount;
    }
    if (method === 'card' && kind === 'payment') {
      if (!data.cardType) throw new ValidationError('Indica si la tarjeta es débito o crédito');
      if (!/^[0-9]{4}$/.test(String(data.cardLast4 ?? ''))) throw new ValidationError('Indica los últimos 4 dígitos de la tarjeta');
      if (!String(data.authorizationCode ?? '').trim()) throw new ValidationError('Indica el número de aprobación del datáfono');
    }
    if (method === 'transfer' && kind === 'payment') {
      if (!data.transferChannel) throw new ValidationError('Indica por dónde llegó la transferencia (banco, Nequi, Daviplata…)');
      if (!String(data.reference ?? '').trim()) throw new ValidationError('Indica la referencia o el número del comprobante de la transferencia');
    }
    if (method === 'credit_balance' && kind === 'payment') {
      const saldo = await saldoDelCliente(strapi, data.customer);
      if (amount > saldo) throw new ValidationError(`El cliente tiene ${peso(saldo)} a favor: no alcanza para ${peso(amount)}`);
    }

    data.kind = kind;
    data.purpose = purpose;
    data.state = 'posted';
    if (!data.customer) throw new ValidationError('El pago necesita el cliente');
    if (!data.paidAt) data.paidAt = new Date().toISOString();
    const cuenta = await cuentaDelPanel(strapi);
    if (cuenta) data.receivedBy = cuenta;
    ctx.params.data = data;

    const resultado = await next();
    if (factura) await recalcularPagos(strapi, factura.documentId);
    return resultado;
  });

  // ---- api::cash.cash-movement ----------------------------------------------

  on(strapi, MOVIMIENTO, ['create', 'update', 'delete'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const actual = ctx.action === 'create'
      ? null
      : await strapi.documents(MOVIMIENTO as any).findOne({ documentId: ctx.params.documentId, populate: ['session'] as any } as any);
    const turnoId = ctx.action === 'create' ? toDocumentId(data.session) : (actual as any)?.session?.documentId;
    const turno = await exigirTurnoAbierto(turnoId);
    if (ctx.action === 'delete') return next();

    if (ctx.action === 'update' && 'session' in data && cambia('session', data.session, actual)) {
      throw new ValidationError('Un movimiento no cambia de turno');
    }
    const kind = effective<string>(data, actual, 'kind');
    const amount = Number(effective(data, actual, 'amount'));
    if (kind === 'expense' && !String(effective(data, actual, 'concept') ?? '').trim()) {
      throw new ValidationError('Un gasto necesita el concepto (en qué se gastó)');
    }
    if (kind === 'withdrawal' || kind === 'expense') {
      const disponible = (await efectivoDelTurno(strapi, turno)) + (actual && (actual as any).kind !== 'cash_in' ? Number((actual as any).amount) : 0);
      if (amount > disponible) {
        throw new ValidationError(`En la caja hay ${peso(disponible)} en efectivo: no se pueden sacar ${peso(amount)}`);
      }
    }
    if (ctx.action === 'create') {
      data.session = turno.documentId;
      if (!data.occurredAt) data.occurredAt = new Date().toISOString();
      const cuenta = await cuentaDelPanel(strapi);
      if (cuenta) data.performedBy = cuenta;
    }
    ctx.params.data = data;
    return next();
  });
};
