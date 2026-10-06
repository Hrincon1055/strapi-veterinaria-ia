import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  effective,
  effectiveRelation,
  esDiferenciaVacia,
  isAfter,
  loadCurrent,
  on,
  toDocumentId,
} from './helpers';
import { includeArchived } from './archived';
import { calcularRenglon, calcularTotales, TARIFAS_GRAVADO } from '../api/billing/domain/calculo';
import { CATALOGOS, LINEAS_FACTURABLES, TIPOS_DE_RENGLON, type Relacion } from '../api/billing/domain/fuentes';
import { estaEmitiendo } from '../api/billing/domain/emision';
import { cambiandoPrecio } from '../api/billing/domain/cambio-precio';

const FACTURA = 'api::billing.invoice';
const RENGLON = 'api::billing.invoice-item';
const HOSPITALIZACION = 'api::hospitalization.hospitalization';

/**
 * Lo único que puede cambiar en una factura que ya salió de borrador: su
 * ciclo (`state`), el cobro, lo que mueve el proveedor DIAN, la anulación, la
 * etiqueta de búsqueda (la reescribe `validations/labels.ts`) y el archivado
 * de una anulada.
 */
const EDITABLE_TRAS_EMITIR = [
  'state', 'paymentState', 'dianState', 'pdfUrl', 'xmlUrl', 'dataicoInvoiceId',
  'voidedAt', 'voidReason', 'searchLabel', 'archivedAt',
];

/**
 * Numeración y datos congelados: solo se escriben en el mismo paso que pasa
 * la factura de borrador a emitida (fase de emisión). Un borrador no consume
 * consecutivo.
 */
const DE_LA_EMISION = [
  'prefix', 'number', 'fullNumber', 'resolutionNumber', 'resolutionDate',
  'resolutionRangeFrom', 'resolutionRangeTo', 'resolutionValidUntil',
  'issuedAt', 'buyer', 'issuerSnapshot',
];

/** Los totales los calcula `recalcularFactura` a partir de los renglones. */
const TOTALES = ['subtotal', 'discountTotal', 'taxTotal', 'amount'];

const RELACIONES_FACTURA = ['customer', 'subscription', 'items', 'correctsInvoice'];

/**
 * El panel manda cada relación como diferencia; la que no se tocó llega como
 * `{ connect: [], disconnect: [] }`. Eso no es un cambio.
 */
const sinId = (o: any): any => {
  if (!o || typeof o !== 'object') return o ?? null;
  const { id, __component, ...resto } = o;
  return resto;
};

/**
 * ¿Este campo cambia de verdad? El panel reenvía el formulario entero al
 * guardar, incluidos los campos que no se tocaron; comparar con lo guardado es
 * lo que permite, por ejemplo, marcar como pagada una factura emitida desde el
 * propio formulario.
 */
function cambia(campo: string, valor: any, actual: any): boolean {
  if (RELACIONES_FACTURA.includes(campo)) {
    if (valor === undefined || esDiferenciaVacia(valor)) return false;
    if (campo === 'items') return true;
    return (toDocumentId(valor) ?? null) !== (actual?.[campo]?.documentId ?? null);
  }
  if (campo === 'buyer' || campo === 'issuerSnapshot') {
    return JSON.stringify(sinId(valor)) !== JSON.stringify(sinId(actual?.[campo]));
  }
  const norm = (v: any) => (v === undefined || v === null || v === '' ? '' : String(v));
  const a = norm(valor);
  const b = norm(actual?.[campo]);
  if (a === b) return false;
  // Una fecha puede volver con otra precisión (".000Z").
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return !(a && b && /\d{4}-\d{2}-\d{2}/.test(a) && !Number.isNaN(ta) && ta === tb);
}

/**
 * Recalcula y guarda los totales de la factura a partir de sus renglones.
 *
 * Escribe con el query engine y no con el Document Service a propósito: los
 * totales son del servidor, y el middleware de la factura descarta cualquier
 * total que llegue por el Document Service (el panel los reenvía al guardar).
 * Esta es la única vía por la que cambian.
 */
export async function recalcularFactura(strapi: Core.Strapi, invoiceDocumentId: string): Promise<void> {
  const renglones = await strapi.documents(RENGLON as any).findMany({
    filters: { invoice: { documentId: invoiceDocumentId } } as any,
    fields: ['quantity', 'unitPrice', 'discountAmount', 'taxTreatment', 'taxRate'] as any,
  } as any);

  const totales = calcularTotales(
    (renglones as any[])
      .filter((r) => r.unitPrice != null && r.taxTreatment)
      .map((r) => ({
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        discountAmount: r.discountAmount,
        taxTreatment: r.taxTreatment,
        taxRate: r.taxRate,
      }))
  );

  await strapi.db.query(FACTURA as any).update({ where: { documentId: invoiceDocumentId }, data: totales });
}

/** "la factura FE-1023" o "un borrador (<documentId>)": para los mensajes de error. */
const nombreFactura = (f: any): string =>
  f?.fullNumber ? `la factura ${f.fullNumber}` : `un borrador (${f?.documentId ?? '?'})`;

export default (strapi: Core.Strapi): void => {
  // ---- api::billing.subscription ------------------------------------------

  on(strapi, 'api::billing.subscription', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['customer', 'pet']);

    const startOn = effective<string>(data, current, 'startOn');
    const endOn = effective<string>(data, current, 'endOn');

    if (startOn && endOn && !isAfter(endOn, startOn)) {
      throw new ValidationError('La fecha de fin debe ser posterior a la de inicio');
    }

    // La mascota suscrita debe pertenecer al cliente que contrata.
    const customerId = effectiveRelation(data, current, 'customer');
    const petId = effectiveRelation(data, current, 'pet');

    if (customerId && petId) {
      const pet = await strapi.documents('api::pet.pet').findOne({
        documentId: petId,
        populate: ['owner'] as any,
      });
      const ownerId = (pet as any)?.owner?.documentId;
      if (ownerId && ownerId !== customerId) {
        throw new ValidationError('Esa mascota no pertenece al cliente de la suscripción');
      }
    }

    return next();
  });

  // ---- api::billing.benefit-usage -----------------------------------------

  on(strapi, 'api::billing.benefit-usage', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['subscription', 'benefit']);

    const subscriptionId = effectiveRelation(data, current, 'subscription');
    const benefitId = effectiveRelation(data, current, 'benefit');

    if (!subscriptionId || !benefitId) return next();

    const [subscription, benefit] = await Promise.all([
      strapi.documents('api::billing.subscription').findOne({
        documentId: subscriptionId,
        populate: ['plan'] as any,
      }),
      strapi.documents('api::billing.plan-benefit').findOne({
        documentId: benefitId,
        populate: ['plan'] as any,
      }),
    ]);

    if (!subscription) throw new ValidationError('La suscripción indicada no existe');
    if (!benefit) throw new ValidationError('El beneficio indicado no existe');

    if ((subscription as any).state !== 'active') {
      throw new ValidationError('Solo se pueden consumir beneficios de una suscripción activa');
    }

    const subPlan = (subscription as any).plan?.documentId;
    const benefitPlan = (benefit as any).plan?.documentId;
    if (subPlan && benefitPlan && subPlan !== benefitPlan) {
      throw new ValidationError('Ese beneficio no pertenece al plan de la suscripción');
    }

    // Cupo anual: se cuenta dentro de la vigencia de la suscripción.
    // quantityPerYear vacío significa ilimitado.
    const quota = (benefit as any).quantityPerYear;
    if (quota != null) {
      const used = await strapi.documents('api::billing.benefit-usage').count({
        filters: {
          subscription: { documentId: subscriptionId },
          benefit: { documentId: benefitId },
          usedAt: {
            $gte: (subscription as any).startOn,
            $lte: (subscription as any).endOn,
          },
          ...(ctx.params.documentId ? { documentId: { $ne: ctx.params.documentId } } : {}),
        } as any,
      });

      if (used >= quota) {
        throw new ValidationError(
          `El beneficio "${(benefit as any).name}" ya agotó sus ${quota} usos de la vigencia`
        );
      }
    }

    return next();
  });

  // ---- api::billing.invoice -----------------------------------------------
  //
  // Ciclo: draft → issued ↔ dian_error → voided. Un borrador se edita y se
  // borra; una factura emitida no se borra ni se edita: se anula. Anular libera
  // los renglones (`lockKey = null`) para que sus conceptos vuelvan a quedar
  // pendientes de cobro.

  on(strapi, FACTURA, ['delete'], async (ctx, next) => {
    const actual: any = await strapi.documents(FACTURA as any).findOne({
      documentId: ctx.params.documentId,
      populate: ['items'] as any,
      filters: includeArchived(FACTURA) as any,
    } as any);
    if (!actual) return next();

    if (actual.state !== 'draft') {
      throw new ValidationError(
        `No se puede borrar ${nombreFactura(actual)}: una factura emitida se anula, no se borra`
      );
    }

    // Strapi no borra en cascada: un renglón huérfano seguiría reteniendo su
    // línea de consulta (`lockKey`) y ya nadie podría cobrarla.
    for (const r of actual.items ?? []) {
      await strapi.documents(RENGLON as any).delete({ documentId: r.documentId });
    }
    return next();
  });

  on(strapi, FACTURA, ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const actual = await loadCurrent(strapi, ctx, ['customer', 'subscription', 'correctsInvoice', 'buyer']);
    const estadoActual: string = actual?.state ?? 'draft';
    const estado: string = effective<string>(data, actual, 'state') ?? 'draft';

    // Los totales son del servidor (ver `recalcularFactura`).
    for (const t of TOTALES) delete data[t];
    // Los renglones se añaden creando `invoice-item`, que es quien valida cada
    // concepto. Conectarlos desde aquí se saltaría esa validación.
    if ('items' in data) {
      if (!esDiferenciaVacia(data.items)) {
        throw new ValidationError('Los renglones se añaden o quitan como renglones de factura, no desde la factura');
      }
      delete data.items;
    }
    ctx.params.data = data;

    const tocados = Object.keys(data).filter((k) => cambia(k, data[k], actual));

    // Una emitida o anulada queda congelada salvo su ciclo y lo que mueve la DIAN.
    if (ctx.action === 'update' && estadoActual !== 'draft') {
      const prohibidos = tocados.filter((k) => !EDITABLE_TRAS_EMITIR.includes(k));
      if (prohibidos.length > 0) {
        throw new ValidationError(
          `${nombreFactura(actual)} está en estado "${estadoActual}" y solo admite cambios en ` +
            `${EDITABLE_TRAS_EMITIR.join(', ')}; se intentó cambiar: ${prohibidos.join(', ')}`
        );
      }
    }

    if (effective<string>(data, actual, 'documentKind') === 'credit_note' || effectiveRelation(data, actual, 'correctsInvoice')) {
      throw new ValidationError('Las notas crédito todavía no están disponibles');
    }

    // --- transiciones de estado ---
    if (ctx.action === 'create' && estado !== 'draft') {
      throw new ValidationError('Una factura nace en borrador; se emite después');
    }
    if (estadoActual !== estado) {
      const permitidas: Record<string, string[]> = {
        draft: ['issued', 'dian_error'],
        issued: ['dian_error', 'voided'],
        dian_error: ['issued', 'voided'],
        voided: [],
      };
      if (!permitidas[estadoActual]?.includes(estado)) {
        const pista = estadoActual === 'draft' && estado === 'voided'
          ? ' Un borrador no se anula: se borra.'
          : '';
        throw new ValidationError(`Una factura no puede pasar de "${estadoActual}" a "${estado}".${pista}`);
      }
    }

    // Numeración y datos congelados: solo al emitir.
    const emitiendo = estadoActual === 'draft' && estado !== 'draft';
    const deEmision = tocados.filter((k) => DE_LA_EMISION.includes(k));
    if (deEmision.length > 0 && !emitiendo) {
      throw new ValidationError(
        `${deEmision.join(', ')} se asignan al emitir la factura, no a mano`
      );
    }
    if (emitiendo) {
      if (!estaEmitiendo()) {
        throw new ValidationError(
          'Una factura se emite desde el módulo de facturación, que asigna el consecutivo de la resolución DIAN'
        );
      }
      for (const k of ['number', 'fullNumber', 'issuedAt']) {
        if (!effective(data, actual, k)) {
          throw new ValidationError(`No se puede emitir sin ${k}: la factura se emite desde el módulo de facturación`);
        }
      }
      const renglones = await strapi.documents(RENGLON as any).count({
        filters: { invoice: { documentId: ctx.params.documentId } } as any,
      });
      if (renglones === 0) throw new ValidationError('No se puede emitir una factura sin renglones');
    }

    // Anular: con motivo, y con fecha si no la trae.
    if (estado === 'voided' && estadoActual !== 'voided') {
      // Una factura que ya recibió la DIAN no se anula por dentro: la DIAN la
      // sigue teniendo por válida. Se corrige con una nota crédito (el hueco
      // está preparado: `documentKind` y `correctsInvoice`).
      if (effective<string>(data, actual, 'dataicoInvoiceId') && estadoActual === 'issued') {
        throw new ValidationError(
          `${nombreFactura(actual)} ya se envió a la DIAN: no se anula, se corrige con una nota crédito`
        );
      }
      const motivo = effective<string>(data, actual, 'voidReason');
      if (!motivo || !String(motivo).trim()) {
        throw new ValidationError('Para anular una factura hay que indicar el motivo (voidReason)');
      }
      if (!data.voidedAt) data.voidedAt = new Date().toISOString();
    }

    // Cobro: solo sobre una factura emitida.
    const pago = effective<string>(data, actual, 'paymentState') ?? 'unpaid';
    if (pago !== 'unpaid' && !['issued', 'dian_error', 'voided'].includes(estado)) {
      throw new ValidationError(`Una factura en estado "${estado}" no puede figurar como pagada`);
    }

    // Archivar es para lo que ya no cuenta: anuladas y borradores vacíos. Un
    // borrador con renglones seguiría reteniendo sus líneas, y archivado nadie
    // lo vería: se borra en su lugar.
    if (tocados.includes('archivedAt') && data.archivedAt) {
      if (!['draft', 'voided'].includes(estado)) {
        throw new ValidationError('Una factura emitida no se archiva: se anula');
      }
      if (estado === 'draft') {
        const renglones = await strapi.documents(RENGLON as any).count({
          filters: { invoice: { documentId: ctx.params.documentId } } as any,
        });
        if (renglones > 0) {
          throw new ValidationError('Un borrador con renglones no se archiva (seguiría reteniendo sus conceptos): bórralo');
        }
      }
    }

    // --- cliente ---
    const clienteId = effectiveRelation(data, actual, 'customer');
    if (ctx.action === 'update' && tocados.includes('customer')) {
      const renglones = await strapi.documents(RENGLON as any).count({
        filters: { invoice: { documentId: ctx.params.documentId } } as any,
      });
      if (renglones > 0) {
        throw new ValidationError('Quita los renglones antes de cambiar el cliente: cada uno se validó contra el cliente actual');
      }
    }
    const suscripcionId = effectiveRelation(data, actual, 'subscription');
    if (suscripcionId && clienteId) {
      const s: any = await strapi.documents('api::billing.subscription').findOne({
        documentId: suscripcionId,
        populate: ['customer'] as any,
      });
      if (s?.customer?.documentId && s.customer.documentId !== clienteId) {
        throw new ValidationError('Esa suscripción no es del cliente de la factura');
      }
    }

    const resultado = await next();

    // Anulada: sus conceptos vuelven a estar disponibles para facturar.
    if (estado === 'voided' && estadoActual !== 'voided') {
      const renglones = await strapi.documents(RENGLON as any).findMany({
        filters: { invoice: { documentId: ctx.params.documentId }, lockKey: { $notNull: true } } as any,
      });
      for (const r of renglones as any[]) {
        await strapi.documents(RENGLON as any).update({ documentId: r.documentId, data: { lockKey: null } as any });
      }
    }

    return resultado;
  });

  // ---- api::billing.invoice-item ------------------------------------------
  //
  // Cada renglón valida su concepto: la línea de consulta que dice cobrar
  // existe, es facturable, es del cliente de la factura y no la cobra ya otra
  // factura viva. Copia precio, impuesto, unidad y costo del catálogo si no los
  // trae (snapshot: cambiar el catálogo no altera facturas existentes) y
  // calcula sus importes.

  on(strapi, RENGLON, ['delete'], async (ctx, next) => {
    const r: any = await strapi.documents(RENGLON as any).findOne({
      documentId: ctx.params.documentId,
      populate: { invoice: { filters: includeArchived(FACTURA) } } as any,
    } as any);
    const factura = r?.invoice;
    if (factura && factura.state !== 'draft') {
      throw new ValidationError(`No se pueden quitar renglones de ${nombreFactura(factura)}: ya no es un borrador`);
    }
    const resultado = await next();
    if (factura) await recalcularFactura(strapi, factura.documentId);
    return resultado;
  });

  on(strapi, RENGLON, ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const actual = await loadCurrent(strapi, ctx, ['invoice', 'service', 'product', 'subscription', 'sourceConsultation', 'sourceHospitalization']);

    const facturaId = effectiveRelation(data, actual, 'invoice');
    if (!facturaId) return next(); // `required-relations` lo rechaza.

    if (ctx.action === 'update' && 'invoice' in data && !esDiferenciaVacia(data.invoice) &&
        toDocumentId(data.invoice) !== actual?.invoice?.documentId) {
      throw new ValidationError('Un renglón no se mueve de factura: quítalo y créalo en la otra');
    }

    const factura: any = await strapi.documents(FACTURA as any).findOne({
      documentId: facturaId,
      populate: ['customer'] as any,
      filters: includeArchived(FACTURA) as any,
    } as any);
    if (!factura) throw new ValidationError('La factura indicada no existe');

    // Fuera de borrador solo se admite liberar el renglón de una anulada.
    if (factura.state !== 'draft') {
      const soloLibera =
        ctx.action === 'update' && factura.state === 'voided' &&
        Object.keys(data).every((k) => k === 'lockKey') && data.lockKey === null;
      if (!soloLibera) {
        throw new ValidationError(`${nombreFactura(factura)} ya no es un borrador: sus renglones no se pueden cambiar`);
      }
      return next();
    }

    const kind = effective<string>(data, actual, 'kind');
    const tipo = kind ? TIPOS_DE_RENGLON[kind] : undefined;
    if (!tipo) return next(); // El enum lo rechaza.

    const clienteId = factura.customer?.documentId;

    // --- renglón que sale de una línea de consulta o de una hospitalización ---
    const consultaId = effectiveRelation(data, actual, 'sourceConsultation');
    const hospitalizacionId = effectiveRelation(data, actual, 'sourceHospitalization');
    const lineKey = effective<string>(data, actual, 'sourceLineKey');

    /**
     * Última defensa amistosa; la definitiva es el índice único parcial
     * `ux_invoice_items_lock`, que también cubre dos borradores simultáneos.
     */
    const exigirNoCobrado = async (nombre: string) => {
      const otro: any = await strapi.documents(RENGLON as any).findFirst({
        filters: {
          lockKey: lineKey,
          ...(ctx.params.documentId ? { documentId: { $ne: ctx.params.documentId } } : {}),
        } as any,
        populate: { invoice: { filters: includeArchived(FACTURA) } } as any,
      } as any);
      if (otro) {
        throw new ValidationError(`"${nombre}" ya se está cobrando en ${nombreFactura(otro.invoice)}`);
      }
      data.lockKey = lineKey;
    };

    if (tipo.origen === 'hospitalizacion') {
      if (consultaId) throw new ValidationError(`Un renglón "${kind}" no lleva consulta de origen`);
      if (!hospitalizacionId || !lineKey) {
        throw new ValidationError('Un renglón de hospitalización debe indicar la hospitalización (sourceHospitalization) y el concepto (sourceLineKey)');
      }
      const h: any = await strapi.documents(HOSPITALIZACION as any).findOne({
        documentId: hospitalizacionId,
        populate: { pet: { populate: ['owner'] } } as any,
      } as any);
      if (!h) throw new ValidationError('La hospitalización indicada no existe');
      if (h.pet?.owner?.documentId !== clienteId) {
        throw new ValidationError('Esa hospitalización es de una mascota de otro cliente');
      }
      const conceptos: any[] = (await strapi.service(HOSPITALIZACION as any).conceptosFacturables(hospitalizacionId)) ?? [];
      const concepto = conceptos.find((c) => c.lineKey === lineKey);
      if (!concepto) {
        throw new ValidationError('Ese concepto no existe en la hospitalización (un día fuera de la estancia o una toma que ya no consta como dada)');
      }
      if (concepto.kind !== kind) {
        throw new ValidationError(`El concepto "${concepto.label}" es "${concepto.kind}", no corresponde a un renglón "${kind}"`);
      }
      if (!concepto.facturable) throw new ValidationError(`"${concepto.label}" no es facturable: ${concepto.motivo}`);

      // El concepto manda: su servicio o producto y su cantidad.
      const rel: Relacion = concepto.relacion;
      const pedido = rel in data && !esDiferenciaVacia(data[rel]) ? toDocumentId(data[rel]) : undefined;
      if (pedido && pedido !== concepto.destino?.documentId) {
        throw new ValidationError(`El ${rel} del renglón no coincide con el del concepto de la hospitalización`);
      }
      data[rel] = concepto.destino?.documentId;
      data.quantity = Number(concepto.quantity);
      if (!effective(data, actual, 'description')) data.description = concepto.label;
      await exigirNoCobrado(concepto.label);
    } else if (tipo.componente) {
      if (hospitalizacionId) throw new ValidationError(`Un renglón "${kind}" no lleva hospitalización de origen`);
      if (!consultaId || !lineKey) {
        throw new ValidationError('Un renglón de consulta debe indicar la consulta (sourceConsultation) y la línea (sourceLineKey)');
      }
      const consulta: any = await strapi.documents('api::clinical.consultation').findOne({
        documentId: consultaId,
        populate: {
          pet: { populate: ['owner'] },
          lines: { on: { 'clinical.service-line': { populate: ['service'] }, 'clinical.product-line': { populate: ['product'] } } },
        } as any,
        filters: includeArchived('api::clinical.consultation') as any,
      } as any);
      if (!consulta) throw new ValidationError('La consulta indicada no existe');
      if (consulta.archivedAt) throw new ValidationError('La consulta está archivada: no se factura');

      if (consulta.pet?.owner?.documentId !== clienteId) {
        throw new ValidationError('Esa consulta es de una mascota de otro cliente');
      }

      const linea = (consulta.lines ?? []).find((l: any) => l.lineKey === lineKey);
      if (!linea) throw new ValidationError('Esa línea no existe en la consulta (o se quitó después)');
      if (linea.__component !== tipo.componente) {
        throw new ValidationError(`La línea es de tipo ${linea.__component}, no corresponde a un renglón "${kind}"`);
      }
      const facturable = LINEAS_FACTURABLES[linea.__component];
      if (!facturable?.facturable(linea)) {
        throw new ValidationError(`La línea "${linea.label ?? ''}" está en estado "${linea.state}" y no es facturable`);
      }

      // El concepto es la línea: su servicio o producto y su cantidad mandan.
      const rel = facturable.relacion;
      const deLaLinea = linea[rel]?.documentId;
      const pedido = rel in data && !esDiferenciaVacia(data[rel]) ? toDocumentId(data[rel]) : undefined;
      if (pedido && pedido !== deLaLinea) {
        throw new ValidationError(`El ${rel} del renglón no coincide con el de la línea de la consulta`);
      }
      data[rel] = deLaLinea;
      data.quantity = Number(linea.quantity);
      if (!effective(data, actual, 'description')) data.description = linea.label ?? undefined;

      await exigirNoCobrado(linea.label ?? 'Esa línea');
    } else {
      if (consultaId || hospitalizacionId || lineKey) {
        throw new ValidationError(`Un renglón "${kind}" no lleva consulta ni hospitalización de origen`);
      }
      data.lockKey = null;
    }

    // --- relación con el catálogo, coherente con el tipo ---
    const relaciones: Relacion[] = ['service', 'product', 'subscription'];
    const valorDe = (r: Relacion) =>
      r in data && !esDiferenciaVacia(data[r]) ? toDocumentId(data[r]) : actual?.[r]?.documentId ?? null;
    for (const r of relaciones) {
      const v = valorDe(r);
      if (tipo.relacion === r && !v) throw new ValidationError(`Un renglón "${kind}" debe indicar su ${r}`);
      if (tipo.relacion !== r && v) throw new ValidationError(`Un renglón "${kind}" no lleva ${r}`);
    }

    // --- snapshot del catálogo: solo lo que no venga dado ---
    const relacion = tipo.relacion;
    const destinoId = relacion ? valorDe(relacion) : null;
    const cambioDestino = relacion && ctx.action === 'update' && destinoId !== (actual?.[relacion]?.documentId ?? null);
    let precioCatalogo: number | null = null;
    if (relacion && destinoId && (ctx.action === 'create' || cambioDestino)) {
      const cat = CATALOGOS[relacion];
      const e: any = await strapi.documents(cat.uid as any).findOne({
        documentId: destinoId,
        populate: relacion === 'subscription' ? (['customer'] as any) : (['tax'] as any),
      });
      if (!e) throw new ValidationError(`El ${relacion} indicado no existe`);
      const nombre = cat.descripcion(e);

      if (relacion === 'subscription' && e.customer?.documentId !== clienteId) {
        throw new ValidationError('Esa suscripción no es del cliente de la factura');
      }
      if (cat.precio) precioCatalogo = e[cat.precio] ?? null;
      if (cat.precio && (!(('unitPrice') in data) || data.unitPrice == null)) {
        if (e[cat.precio] == null) {
          throw new ValidationError(`"${nombre}" no tiene precio de venta en el catálogo; defínelo antes de facturarlo`);
        }
        data.unitPrice = e[cat.precio];
      }
      if (relacion !== 'subscription' && (!('taxTreatment' in data) || !data.taxTreatment)) {
        if (!e.tax?.ivaTreatment) {
          throw new ValidationError(
            `"${nombre}" no tiene perfil tributario (IVA) en el catálogo; defínelo antes de facturarlo`
          );
        }
        data.taxTreatment = e.tax.ivaTreatment;
        data.taxRate = e.tax.ivaRate ?? 0;
      }
      if (!('unit' in data) || !data.unit) data.unit = cat.unidad(e);
      if (cat.costo && e[cat.costo] != null) data.unitCost = e[cat.costo];
      if (!effective(data, actual, 'description')) data.description = nombre;
    }

    // --- precio manual (D5) ---
    // El precio es el del catálogo; para rebajarlo está el descuento, que se
    // ve en la factura. Uno distinto solo entra por `conCambioDePrecio` (el
    // plugin lo abre tras comprobar `facturacion.cambiar-precio`) y con
    // motivo. Se compara con el catálogo si el concepto es nuevo o cambió, y
    // con lo guardado si no: el Content Manager reenvía el precio sin cambios.
    if (relacion && CATALOGOS[relacion].precio) {
      const referencia = precioCatalogo ?? actual?.unitPrice ?? null;
      const precio = effective<number>(data, actual, 'unitPrice');
      const motivo = 'priceOverrideReason' in data ? String(data.priceOverrideReason ?? '').trim() || null : undefined;
      if (referencia != null && precio != null && Number(precio) !== Number(referencia)) {
        if (!cambiandoPrecio()) {
          throw new ValidationError(
            'El precio del renglón es el del catálogo; para rebajarlo usa el descuento. Cambiarlo exige el permiso "Cambiar precios de catálogo" y un motivo, desde Facturación'
          );
        }
        if (!motivo) throw new ValidationError('Indica el motivo del cambio de precio');
        data.priceOverrideReason = motivo;
      } else if (precioCatalogo != null) {
        data.priceOverrideReason = null; // concepto nuevo o cambiado: precio de catálogo
      } else if (motivo !== undefined && motivo !== (actual?.priceOverrideReason ?? null) && !cambiandoPrecio()) {
        throw new ValidationError('El motivo del cambio de precio solo se escribe al cambiar el precio, desde Facturación');
      }
    }

    // --- importes ---
    const unitPrice = effective<number>(data, actual, 'unitPrice');
    const taxTreatment = effective<any>(data, actual, 'taxTreatment');
    if (unitPrice == null) throw new ValidationError('El renglón necesita precio unitario (unitPrice)');
    if (!taxTreatment) throw new ValidationError('El renglón necesita tratamiento de IVA (taxTreatment)');

    let taxRate = Number(effective<number>(data, actual, 'taxRate') ?? 0);
    if (taxTreatment === 'gravado' && !TARIFAS_GRAVADO.includes(taxRate)) {
      throw new ValidationError(`Un renglón gravado lleva tarifa ${TARIFAS_GRAVADO.join(' o ')}; tiene ${taxRate}`);
    }
    if (taxTreatment !== 'gravado') taxRate = 0;
    data.taxRate = taxRate;

    const quantity = effective<number>(data, actual, 'quantity') ?? 1;
    const discountAmount = Number(effective<number>(data, actual, 'discountAmount') ?? 0);
    const c = calcularRenglon({ quantity, unitPrice, discountAmount, taxTreatment, taxRate });
    if (discountAmount > c.bruto) {
      throw new ValidationError(`El descuento (${discountAmount}) supera el valor del renglón (${c.bruto})`);
    }
    data.lineSubtotal = c.lineSubtotal;
    data.lineTax = c.lineTax;
    data.lineTotal = c.lineTotal;
    ctx.params.data = data;

    const resultado = await next();
    await recalcularFactura(strapi, facturaId);
    return resultado;
  });
};
