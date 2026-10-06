import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { DENOMINACIONES, saldoAFavor, totalesDelTurno, tramoDeCartera } from '../domain/caja';
import { CONSUMIDOR_FINAL } from '../../../bootstrap/seed';

const { ValidationError } = errors;

/**
 * El punto de venta (plugin `veterinaria-caja`, sección 5.7).
 *
 * Orquesta, no valida: escribe por el Document Service y deciden las reglas
 * de `src/validations/cash.ts` y `billing.ts`. La factura la arma y emite
 * `api::billing.invoicing`, igual que desde Facturación; aquí solo se junta
 * todo en un cobro.
 */

const CAJA = 'api::cash.cash-register';
const TURNO = 'api::cash.cash-session';
const PAGO = 'api::cash.payment';
const MOVIMIENTO = 'api::cash.cash-movement';
const FACTURA = 'api::billing.invoice';
const RENGLON = 'api::billing.invoice-item';

const texto = (v: any): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const nombre = (p: any): string | null => (p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || null : null);
const cuenta = (u: any): string | null => (u ? `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || null : null);
const documento = (p: any): string | null => (p?.documentNumber ? `${String(p.documentType ?? '').toUpperCase()} ${p.documentNumber}` : null);
const entero = (v: any): number => Math.round(Number(v) || 0);

export type PagoEntrante = {
  medio: 'cash' | 'card' | 'transfer' | 'credit_balance';
  valor: number;
  recibido?: number;
  tipoTarjeta?: 'debit' | 'credit';
  franquicia?: string;
  ultimos4?: string;
  aprobacion?: string;
  canal?: 'bank' | 'nequi' | 'daviplata' | 'other';
  referencia?: string;
  notas?: string;
};

export type RenglonEntrante =
  | { tipo: 'catalogo'; relacion: 'service' | 'product'; documentId: string; cantidad?: number; descuento?: number }
  | { tipo: 'concepto'; consulta?: string; hospitalizacion?: string; lineKey: string; descuento?: number };

/** Los datos de un pago tal como los pide `api::cash.payment`. */
const aPago = (p: PagoEntrante) => ({
  method: p.medio,
  amount: entero(p.valor),
  ...(p.medio === 'cash' ? { receivedAmount: p.recibido === undefined || p.recibido === null ? entero(p.valor) : entero(p.recibido) } : {}),
  ...(p.medio === 'card' ? { cardType: p.tipoTarjeta, cardBrand: texto(p.franquicia), cardLast4: texto(p.ultimos4), authorizationCode: texto(p.aprobacion) } : {}),
  ...(p.medio === 'transfer' ? { transferChannel: p.canal, reference: texto(p.referencia) } : {}),
  notes: texto(p.notas),
});

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const invoicing = () => strapi.service('api::billing.invoicing') as any;

  async function consumidorFinal(): Promise<any> {
    const perfil: any = await strapi.documents('api::identity.profile').findFirst({
      filters: { documentType: CONSUMIDOR_FINAL.documentType, documentNumber: CONSUMIDOR_FINAL.documentNumber } as any,
      populate: ['customer'] as any,
    } as any);
    if (!perfil?.customer) throw new ValidationError('Falta el cliente "Consumidor final" (lo crea el arranque)');
    return perfil.customer;
  }

  async function exigirTurno(turnoId: string): Promise<any> {
    const t: any = await strapi.documents(TURNO as any).findOne({
      documentId: turnoId,
      populate: { register: { fields: ['name', 'location'] }, responsible: { fields: ['firstname', 'lastname'] } } as any,
    } as any);
    if (!t) throw new ValidationError('El turno no existe');
    return t;
  }

  /** Estado del turno con lo registrado hasta ahora. */
  async function resumen(turnoId: string) {
    const t = await exigirTurno(turnoId);
    const [pagos, movimientos]: any[] = await Promise.all([
      strapi.documents(PAGO as any).findMany({
        filters: { session: { documentId: turnoId } } as any,
        populate: { invoice: { fields: ['fullNumber'] }, customer: { populate: { profile: { fields: ['firstName', 'lastName'] } } } } as any,
        sort: 'paidAt:desc',
        limit: 1000,
      } as any),
      strapi.documents(MOVIMIENTO as any).findMany({ filters: { session: { documentId: turnoId } } as any, sort: 'occurredAt:desc', limit: 1000 } as any),
    ]);
    const totales = t.state === 'closed' && t.totals ? t.totals : totalesDelTurno(Number(t.openingFloat ?? 0), pagos, movimientos);
    return {
      documentId: t.documentId,
      estado: t.state,
      caja: t.register ? { documentId: t.register.documentId, nombre: t.register.name, ubicacion: t.register.location ?? null } : null,
      responsable: cuenta(t.responsible),
      apertura: t.openedAt,
      cierre: t.closedAt ?? null,
      base: Number(t.openingFloat ?? 0),
      contado: t.countedCash ?? null,
      esperado: t.state === 'closed' ? t.expectedCash : totales.efectivoEsperado,
      descuadre: t.difference ?? null,
      motivoDescuadre: t.differenceReason ?? null,
      totales,
      pagos: pagos.map((p: any) => ({
        documentId: p.documentId,
        tipo: p.kind,
        destino: p.purpose,
        medio: p.method,
        valor: p.amount,
        cambio: p.changeAmount ?? 0,
        estado: p.state,
        fecha: p.paidAt,
        factura: p.invoice?.fullNumber ?? null,
        cliente: nombre(p.customer?.profile),
        referencia: p.authorizationCode ?? p.reference ?? null,
      })),
      movimientos: movimientos.map((m: any) => ({ documentId: m.documentId, tipo: m.kind, valor: m.amount, concepto: m.concept ?? null, fecha: m.occurredAt })),
    };
  }

  /** Lo que se imprime: factura (si la hay) y los pagos de este cobro. */
  async function recibo(facturaId: string | null, pagoIds: string[]) {
    const [factura, pagos, clinica]: any[] = await Promise.all([
      facturaId
        ? strapi.documents(FACTURA as any).findOne({
            documentId: facturaId,
            populate: { buyer: true, customer: { populate: ['profile'] }, items: { sort: 'sortOrder:asc' } } as any,
          } as any)
        : null,
      pagoIds.length === 0 ? [] : strapi.documents(PAGO as any).findMany({
        filters: { documentId: { $in: pagoIds } } as any,
        populate: {
          customer: { populate: { profile: { fields: ['firstName', 'lastName', 'documentType', 'documentNumber'] } } },
          receivedBy: { fields: ['firstname', 'lastname'] },
          session: { populate: { register: { fields: ['name'] } } },
        } as any,
      } as any),
      strapi.db.query('api::clinic.clinic').findOne({ select: ['legalName', 'tradeName', 'documentNumber', 'verificationDigit', 'phone'] }),
    ]);
    const perfil = factura?.customer?.profile ?? pagos[0]?.customer?.profile;
    return {
      clinica: clinica ? {
        nombre: clinica.tradeName || clinica.legalName,
        razonSocial: clinica.legalName,
        nit: clinica.documentNumber ? `${clinica.documentNumber}${clinica.verificationDigit ? `-${clinica.verificationDigit}` : ''}` : null,
        telefono: clinica.phone ?? null,
      } : null,
      factura: factura ? {
        documentId: factura.documentId,
        numero: factura.fullNumber,
        emitida: factura.issuedAt,
        subtotal: factura.subtotal,
        descuentos: factura.discountTotal,
        impuesto: factura.taxTotal,
        total: factura.amount,
        pagado: factura.paidAmount,
        saldo: Number(factura.amount) - Number(factura.paidAmount ?? 0),
        estadoPago: factura.paymentState,
        renglones: (factura.items ?? []).map((r: any) => ({
          descripcion: r.description, cantidad: Number(r.quantity), precio: r.unitPrice, descuento: r.discountAmount, total: r.lineTotal,
        })),
      } : null,
      cliente: factura?.buyer?.name ?? nombre(perfil),
      documentoCliente: factura?.buyer?.documentNumber ?? documento(perfil),
      pagos: pagos.map((p: any) => ({
        documentId: p.documentId,
        tipo: p.kind,
        destino: p.purpose,
        medio: p.method,
        valor: p.amount,
        recibido: p.receivedAmount ?? null,
        cambio: p.changeAmount ?? 0,
        referencia: p.authorizationCode ?? p.reference ?? null,
        ultimos4: p.cardLast4 ?? null,
        fecha: p.paidAt,
        cajero: cuenta(p.receivedBy),
        caja: p.session?.register?.name ?? null,
      })),
      cambio: pagos.reduce((s: number, p: any) => s + Number(p.changeAmount ?? 0), 0),
    };
  }

  return {
    recibo,
    denominaciones: () => DENOMINACIONES,
    consumidorFinal,
    resumen,

    /** Cajas activas, con su turno abierto (si lo hay) y si esta cuenta puede abrirlas. */
    async cajas(cuentaId: string | null) {
      const [cajas, abiertos]: any[] = await Promise.all([
        strapi.documents(CAJA as any).findMany({
          filters: { isActive: { $ne: false } } as any,
          populate: { operators: { fields: ['documentId'] } } as any,
          sort: 'name:asc',
        } as any),
        strapi.documents(TURNO as any).findMany({
          filters: { state: 'open' } as any,
          populate: { register: { fields: ['documentId'] }, responsible: { fields: ['firstname', 'lastname'] } } as any,
        } as any),
      ]);
      return cajas.map((c: any) => {
        const t = abiertos.find((x: any) => x.register?.documentId === c.documentId);
        const operadores = (c.operators ?? []).map((o: any) => o.documentId);
        return {
          documentId: c.documentId,
          nombre: c.name,
          ubicacion: c.location ?? null,
          baseSugerida: Number(c.defaultOpeningFloat ?? 0),
          autorizada: !cuentaId || operadores.length === 0 || operadores.includes(cuentaId),
          turnoAbierto: t ? { documentId: t.documentId, responsable: cuenta(t.responsible), apertura: t.openedAt } : null,
        };
      });
    },

    /** Turno abierto de esta cuenta, o null. */
    async turnoDe(cuentaId: string) {
      const t: any = await strapi.documents(TURNO as any).findFirst({
        filters: { responsible: { documentId: cuentaId }, state: 'open' } as any,
        fields: ['documentId'] as any,
      } as any);
      return t ? resumen(t.documentId) : null;
    },

    async abrir({ caja, base, conteo, notas }: { caja: string; base?: number; conteo?: any[]; notas?: string }) {
      if (!caja) throw new ValidationError('Elige la caja');
      const t: any = await strapi.documents(TURNO as any).create({
        data: {
          register: caja,
          ...(base !== undefined && base !== null && base !== ('' as any) ? { openingFloat: entero(base) } : {}),
          ...(Array.isArray(conteo) && conteo.length > 0 ? { openingCount: conteo.filter((c) => Number(c.quantity) > 0) } : {}),
          notes: texto(notas),
        } as any,
      } as any);
      return resumen(t.documentId);
    },

    async cerrar(turnoId: string, { conteo, motivo, notas }: { conteo: any[]; motivo?: string; notas?: string }) {
      await strapi.documents(TURNO as any).update({
        documentId: turnoId,
        data: {
          state: 'closed',
          closingCount: (conteo ?? []).map((c) => ({ denomination: entero(c.denomination), kind: c.kind ?? 'bill', quantity: entero(c.quantity) })),
          differenceReason: texto(motivo),
          ...(texto(notas) ? { notes: texto(notas) } : {}),
        } as any,
      } as any);
      return resumen(turnoId);
    },

    /** Categorías (de producto + "Servicios") y lo vendible, con foto, precio e IVA. */
    async catalogo({ categoria, q }: { categoria?: string; q?: string }) {
      const t = texto(q);
      const categorias: any[] = await strapi.documents('api::catalog.product-category').findMany({
        filters: { isActive: { $ne: false } } as any,
        fields: ['name', 'sortOrder'] as any,
        sort: ['sortOrder:asc', 'name:asc'],
      } as any);
      const verServicios = !categoria || categoria === 'servicios';
      const verProductos = !categoria || categoria !== 'servicios';
      const [productos, servicios]: any[] = await Promise.all([
        verProductos
          ? strapi.documents('api::catalog.product').findMany({
              filters: {
                isActive: { $ne: false },
                ...(categoria && categoria !== 'servicios' ? { category: { documentId: categoria } } : {}),
                ...(t ? { searchLabel: { $containsi: t } } : {}),
              } as any,
              populate: { tax: true, image: { fields: ['url', 'formats', 'alternativeText'] } } as any,
              sort: 'name:asc',
              limit: 200,
            } as any)
          : [],
        verServicios
          ? strapi.documents('api::scheduling.service').findMany({
              filters: { isActive: { $ne: false }, ...(t ? { name: { $containsi: t } } : {}) } as any,
              populate: { tax: true } as any,
              sort: 'name:asc',
              limit: 200,
            } as any)
          : [],
      ]);
      const problema = (precio: any, tax: any) =>
        precio == null ? 'sin precio de venta' : !tax?.ivaTreatment ? 'sin perfil tributario (IVA)' : null;
      const precioConIva = (precio: number, tax: any) =>
        tax?.ivaTreatment === 'gravado' ? Math.round(precio * (1 + Number(tax.ivaRate ?? 0) / 100)) : precio;
      return {
        categorias: [...categorias.map((c) => ({ documentId: c.documentId, nombre: c.name })), { documentId: 'servicios', nombre: 'Servicios' }],
        items: [
          ...productos.map((p: any) => ({
            relacion: 'product',
            documentId: p.documentId,
            nombre: p.name,
            detalle: p.presentation ?? p.brand ?? null,
            unidad: p.saleUnit,
            precio: p.salePrice ?? null,
            precioConIva: p.salePrice == null ? null : precioConIva(p.salePrice, p.tax),
            iva: p.tax?.ivaTreatment === 'gravado' ? Number(p.tax.ivaRate) : 0,
            imagen: p.image?.formats?.small?.url ?? p.image?.formats?.thumbnail?.url ?? p.image?.url ?? null,
            problema: problema(p.salePrice, p.tax),
          })),
          ...servicios.map((s: any) => ({
            relacion: 'service',
            documentId: s.documentId,
            nombre: s.name,
            detalle: s.defaultDurationMinutes ? `${s.defaultDurationMinutes} min` : null,
            unidad: 'servicio',
            precio: s.basePrice ?? null,
            precioConIva: s.basePrice == null ? null : precioConIva(s.basePrice, s.tax),
            iva: s.tax?.ivaTreatment === 'gravado' ? Number(s.tax.ivaRate) : 0,
            color: s.colorHex ?? null,
            imagen: null,
            problema: problema(s.basePrice, s.tax),
          })),
        ],
      };
    },

    /** Clientes por nombre o documento; Consumidor final siempre disponible. */
    async buscarClientes(q?: string) {
      const t = texto(q);
      const cf = await consumidorFinal();
      const clientes: any[] = t
        ? await strapi.documents('api::customer.customer').findMany({
            filters: { searchLabel: { $containsi: t } } as any,
            fields: ['searchLabel'] as any,
            sort: 'searchLabel:asc',
            limit: 15,
          } as any)
        : [];
      return [
        { documentId: cf.documentId, etiqueta: 'Consumidor final', consumidorFinal: true },
        ...clientes.filter((c) => c.documentId !== cf.documentId).map((c) => ({ documentId: c.documentId, etiqueta: c.searchLabel, consumidorFinal: false })),
      ];
    },

    /** Ficha nueva para quien pide la factura a su nombre (C5). */
    async crearCliente({ nombres, apellidos, tipoDocumento, documento: numero, telefono, correo }: any) {
      if (!texto(nombres) || !texto(tipoDocumento) || !texto(numero)) throw new ValidationError('Indica nombre, tipo y número de documento');
      return strapi.db.transaction(async () => {
        const perfil: any = await strapi.documents('api::identity.profile').create({
          data: { firstName: texto(nombres), lastName: texto(apellidos), documentType: tipoDocumento, documentNumber: texto(numero) } as any,
        });
        if (texto(telefono)) {
          await strapi.documents('api::shared.contact').create({ data: { profile: perfil.documentId, contactType: 'phone', value: texto(telefono), isPrimary: true } as any });
        }
        if (texto(correo)) {
          await strapi.documents('api::shared.contact').create({ data: { profile: perfil.documentId, contactType: 'email', value: texto(correo), isPrimary: true } as any });
        }
        // Tratamiento de datos: lo exige la factura a su nombre; lo demás, no se asume.
        const cliente: any = await strapi.documents('api::customer.customer').create({
          data: { profile: perfil.documentId, consents: { marketing: false, sms: false, email: false, dataProcessing: true } } as any,
        });
        return { documentId: cliente.documentId, etiqueta: `${nombre(perfil)} · ${documento(perfil)}`, consumidorFinal: false };
      });
    },

    /** Lo que el cliente tiene por pagar y a favor: pendientes de cobro, cartera y saldo a favor. */
    async cliente(clienteId: string) {
      const c: any = await strapi.documents('api::customer.customer').findOne({
        documentId: clienteId,
        populate: { profile: { populate: { contacts: { fields: ['contactType', 'value', 'isPrimary'] } } } } as any,
      } as any);
      if (!c) return null;
      const cf = await consumidorFinal();
      const [pendientes, facturas, pagos]: any[] = await Promise.all([
        c.documentId === cf.documentId ? [] : invoicing().pendientes({ cliente: clienteId }),
        strapi.documents(FACTURA as any).findMany({
          filters: { customer: { documentId: clienteId }, state: { $in: ['issued', 'dian_error'] } } as any,
          fields: ['fullNumber', 'amount', 'paidAmount', 'issuedAt', 'dueOn'] as any,
          sort: 'issuedAt:asc',
          limit: 500,
        } as any),
        strapi.db.query(PAGO as any).findMany({
          where: { customer: { documentId: clienteId }, state: 'posted' },
          select: ['kind', 'purpose', 'method', 'amount', 'state'],
        }),
      ]);
      const cartera = facturas
        .filter((f: any) => Number(f.amount) > Number(f.paidAmount ?? 0))
        .map((f: any) => ({
          documentId: f.documentId,
          numero: f.fullNumber,
          total: Number(f.amount),
          pagado: Number(f.paidAmount ?? 0),
          saldo: Number(f.amount) - Number(f.paidAmount ?? 0),
          emitida: f.issuedAt,
          vence: f.dueOn ?? null,
          tramo: tramoDeCartera(f.dueOn ?? f.issuedAt),
        }));
      const telefono = (c.profile?.contacts ?? []).find((x: any) => x.contactType !== 'email' && x.contactType !== 'email_work')?.value ?? null;
      return {
        documentId: c.documentId,
        nombre: nombre(c.profile) ?? c.searchLabel,
        documento: documento(c.profile),
        telefono,
        consumidorFinal: c.documentId === cf.documentId,
        pendientes,
        cartera,
        saldoEnCartera: cartera.reduce((s: number, f: any) => s + f.saldo, 0),
        saldoAFavor: saldoAFavor(pagos),
      };
    },

    /**
     * Cobrar (C6): borrador → renglones → emisión → pagos, todo o nada. Si un
     * renglón, la emisión o un pago falla, no queda factura, ni pago, ni
     * consecutivo consumido (la emisión sube el consecutivo dentro de esta
     * misma transacción).
     */
    async cobrar({ turno, cliente, renglones, pagos, notas, vence }: {
      turno: string; cliente?: string; renglones: RenglonEntrante[]; pagos: PagoEntrante[]; notas?: string; vence?: string;
    }) {
      if (!turno) throw new ValidationError('No hay turno de caja abierto');
      if (!Array.isArray(renglones) || renglones.length === 0) throw new ValidationError('El ticket está vacío');
      const pagosValidos = (pagos ?? []).filter((p) => entero(p?.valor) > 0);
      const cf = await consumidorFinal();
      const clienteId = cliente || cf.documentId;

      return strapi.db.transaction(async () => {
        const borrador: any = await invoicing().crearVacia({ cliente: clienteId, notas: texto(notas) ?? undefined });
        const conceptos = renglones
          .filter((r): r is Extract<RenglonEntrante, { tipo: 'concepto' }> => r.tipo === 'concepto')
          .map((r) => ({ consulta: r.consulta, hospitalizacion: r.hospitalizacion, lineKey: r.lineKey, discountAmount: entero(r.descuento) }));
        if (conceptos.length > 0) await invoicing().agregarConceptos(borrador.documentId, conceptos);
        for (const r of renglones) {
          if (r.tipo !== 'catalogo') continue;
          await invoicing().agregarDirecto(borrador.documentId, {
            relacion: r.relacion,
            documentId: r.documentId,
            quantity: Number(r.cantidad ?? 1),
            discountAmount: entero(r.descuento),
          });
        }

        const conTotal: any = await strapi.documents(FACTURA as any).findOne({ documentId: borrador.documentId, fields: ['amount'] as any } as any);
        const total = Number(conTotal.amount);
        const cobrado = pagosValidos.reduce((s, p) => s + entero(p.valor), 0);
        if (cobrado > total) throw new ValidationError(`Los pagos suman $ ${cobrado.toLocaleString('es-CO')} y el total es $ ${total.toLocaleString('es-CO')}`);
        if (cobrado < total && clienteId === cf.documentId) {
          throw new ValidationError('A consumidor final no se le deja saldo pendiente: cobra el total o factura a nombre del cliente');
        }

        const emitida: any = await invoicing().emitir(borrador.documentId, { dueOn: cobrado < total && vence ? vence : undefined });
        const registrados: any[] = [];
        for (const p of pagosValidos) {
          registrados.push(
            await strapi.documents(PAGO as any).create({
              data: { ...aPago(p), kind: 'payment', purpose: 'invoice', invoice: emitida.documentId, customer: clienteId, session: turno } as any,
            } as any)
          );
        }
        return recibo(emitida.documentId, registrados.map((r) => r.documentId));
      });
    },

    /** Abono a una factura ya emitida (cartera). */
    async abonar({ turno, factura, pagos }: { turno: string; factura: string; pagos: PagoEntrante[] }) {
      const pagosValidos = (pagos ?? []).filter((p) => entero(p?.valor) > 0);
      if (pagosValidos.length === 0) throw new ValidationError('Indica el valor del abono');
      return strapi.db.transaction(async () => {
        const ids: string[] = [];
        for (const p of pagosValidos) {
          const r: any = await strapi.documents(PAGO as any).create({
            data: { ...aPago(p), kind: 'payment', purpose: 'invoice', invoice: factura, session: turno } as any,
          } as any);
          ids.push(r.documentId);
        }
        return recibo(factura, ids);
      });
    },

    /** Anticipo: dinero del cliente sin factura, que queda como saldo a favor (C9). */
    async anticipo({ turno, cliente, pagos }: { turno: string; cliente: string; pagos: PagoEntrante[] }) {
      const cf = await consumidorFinal();
      if (!cliente || cliente === cf.documentId) throw new ValidationError('Un anticipo es de un cliente con ficha');
      const pagosValidos = (pagos ?? []).filter((p) => entero(p?.valor) > 0);
      if (pagosValidos.length === 0) throw new ValidationError('Indica el valor del anticipo');
      return strapi.db.transaction(async () => {
        const ids: string[] = [];
        for (const p of pagosValidos) {
          const r: any = await strapi.documents(PAGO as any).create({
            data: { ...aPago(p), kind: 'payment', purpose: 'advance', customer: cliente, session: turno } as any,
          } as any);
          ids.push(r.documentId);
        }
        return recibo(null, ids);
      });
    },

    /** Devolución (C10): de una factura o de un anticipo; en efectivo sale de la caja, o pasa a saldo a favor. */
    async devolver({ turno, factura, cliente, valor, medio, motivo }: {
      turno: string; factura?: string; cliente?: string; valor: number; medio: 'cash' | 'card' | 'transfer' | 'credit_balance'; motivo: string;
    }) {
      if (!texto(motivo)) throw new ValidationError('Indica el motivo de la devolución');
      const r: any = await strapi.documents(PAGO as any).create({
        data: {
          kind: 'refund',
          purpose: factura ? 'invoice' : 'advance',
          ...(factura ? { invoice: factura } : { customer: cliente }),
          method: medio,
          amount: entero(valor),
          session: turno,
          notes: texto(motivo),
        } as any,
      } as any);
      return recibo(factura ?? null, [r.documentId]);
    },

    async reversar(pagoId: string, motivo: string) {
      if (!texto(motivo)) throw new ValidationError('Indica el motivo del reverso');
      await strapi.documents(PAGO as any).update({ documentId: pagoId, data: { state: 'reversed', reversalReason: texto(motivo) } as any } as any);
      return { documentId: pagoId };
    },

    async movimiento({ turno, tipo, valor, concepto, referencia, soporte }: any) {
      const m: any = await strapi.documents(MOVIMIENTO as any).create({
        data: { session: turno, kind: tipo, amount: entero(valor), concept: texto(concepto), reference: texto(referencia), ...(soporte ? { receipt: soporte } : {}) } as any,
      } as any);
      return { documentId: m.documentId };
    },

    /** Cartera: facturas con saldo, por cliente y antigüedad. */
    async cartera({ q }: { q?: string } = {}) {
      const t = texto(q);
      const facturas: any[] = await strapi.documents(FACTURA as any).findMany({
        filters: {
          state: { $in: ['issued', 'dian_error'] },
          paymentState: { $ne: 'paid' },
          ...(t ? { searchLabel: { $containsi: t } } : {}),
        } as any,
        fields: ['fullNumber', 'amount', 'paidAmount', 'issuedAt', 'dueOn'] as any,
        populate: { customer: { populate: { profile: { fields: ['firstName', 'lastName', 'documentType', 'documentNumber'] } } } } as any,
        sort: 'issuedAt:asc',
        limit: 2000,
      } as any);
      const porCliente = new Map<string, any>();
      const tramos = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 } as Record<string, number>;
      for (const f of facturas) {
        const saldo = Number(f.amount) - Number(f.paidAmount ?? 0);
        if (saldo <= 0) continue;
        const tramo = tramoDeCartera(f.dueOn ?? f.issuedAt);
        tramos[tramo] += saldo;
        const id = f.customer?.documentId ?? 'sin-cliente';
        if (!porCliente.has(id)) {
          porCliente.set(id, {
            documentId: f.customer?.documentId ?? null,
            nombre: nombre(f.customer?.profile) ?? '—',
            documento: documento(f.customer?.profile),
            saldo: 0,
            tramos: { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
            facturas: [],
          });
        }
        const c = porCliente.get(id);
        c.saldo += saldo;
        c.tramos[tramo] += saldo;
        c.facturas.push({ documentId: f.documentId, numero: f.fullNumber, total: Number(f.amount), saldo, emitida: f.issuedAt, vence: f.dueOn ?? null, tramo });
      }
      const clientes = [...porCliente.values()].sort((a, b) => b.saldo - a.saldo);
      return { total: clientes.reduce((s, c) => s + c.saldo, 0), tramos, clientes };
    },

    /** Turnos por día y caja, para supervisar (cuadres y descuadres). */
    async turnos({ desde, hasta, caja }: { desde?: string; hasta?: string; caja?: string }) {
      const filtros: any = {};
      if (desde || hasta) {
        filtros.openedAt = {
          ...(desde ? { $gte: `${desde}T00:00:00.000Z` } : {}),
          ...(hasta ? { $lte: `${hasta}T23:59:59.999Z` } : {}),
        };
      }
      if (caja) filtros.register = { documentId: caja };
      const turnos: any[] = await strapi.documents(TURNO as any).findMany({
        filters: filtros,
        populate: { register: { fields: ['name'] }, responsible: { fields: ['firstname', 'lastname'] }, closedBy: { fields: ['firstname', 'lastname'] } } as any,
        sort: 'openedAt:desc',
        limit: 200,
      } as any);
      return turnos.map((t) => ({
        documentId: t.documentId,
        caja: t.register?.name ?? null,
        responsable: cuenta(t.responsible),
        estado: t.state,
        apertura: t.openedAt,
        cierre: t.closedAt ?? null,
        base: Number(t.openingFloat ?? 0),
        esperado: t.expectedCash ?? null,
        contado: t.countedCash ?? null,
        descuadre: t.difference ?? null,
        motivo: t.differenceReason ?? null,
        cerradoPor: cuenta(t.closedBy),
      }));
    },

    /** Lo cobrable de una consulta u hospitalización, para añadirlo al ticket. */
    async origen(tipo: 'consulta' | 'hospitalizacion', documentId: string) {
      return tipo === 'hospitalizacion' ? invoicing().estadoDeHospitalizacion(documentId) : invoicing().estadoDeConsulta(documentId);
    },

    /** Una factura emitida por su número ("FE134"), con sus pagos: devoluciones y reimpresión. */
    async buscarFactura(numero: string) {
      const n = texto(numero)?.toUpperCase();
      if (!n) return null;
      const f: any = await strapi.documents(FACTURA as any).findFirst({ filters: { fullNumber: n } as any, fields: ['documentId'] as any } as any);
      if (!f) return null;
      const pagos: any[] = await strapi.documents(PAGO as any).findMany({ filters: { invoice: { documentId: f.documentId }, state: 'posted' } as any, fields: ['documentId'] as any } as any);
      return recibo(f.documentId, pagos.map((p) => p.documentId));
    },

    /** Pagos de una factura, para Facturación. */
    async pagosDeFactura(facturaId: string) {
      const pagos: any[] = await strapi.documents(PAGO as any).findMany({
        filters: { invoice: { documentId: facturaId } } as any,
        populate: { receivedBy: { fields: ['firstname', 'lastname'] }, session: { populate: { register: { fields: ['name'] } } } } as any,
        sort: 'paidAt:asc',
      } as any);
      return pagos.map((p) => ({
        documentId: p.documentId,
        tipo: p.kind,
        medio: p.method,
        valor: p.amount,
        estado: p.state,
        fecha: p.paidAt,
        referencia: p.authorizationCode ?? p.reference ?? null,
        cajero: cuenta(p.receivedBy),
        caja: p.session?.register?.name ?? null,
        motivoReverso: p.reversalReason ?? null,
      }));
    },

    /** Renglones de una factura, para comprobar que existe (lo usa el controlador). */
    renglones: (facturaId: string) =>
      strapi.documents(RENGLON as any).count({ filters: { invoice: { documentId: facturaId } } as any } as any),
  };
};
