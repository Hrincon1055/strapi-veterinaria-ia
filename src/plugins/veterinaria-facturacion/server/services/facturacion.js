'use strict';

/**
 * Adaptador entre el panel y la facturación.
 *
 * Traduce documentos de Strapi a lo que pintan las pantallas y delega todo lo
 * demás: `api::billing.invoicing` (pendientes, borradores, emisión) y
 * `api::billing.invoice-pdf`. Las escrituras van por el Document Service, así
 * que las reglas de `src/validations/billing.ts` se aplican igual que en el
 * Content Manager o en la API.
 */

const FACTURA = 'api::billing.invoice';
const RENGLON = 'api::billing.invoice-item';

const nombre = (p) => (p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || null : null);
const documento = (p) => (p?.documentNumber ? `${String(p.documentType ?? '').toUpperCase()} ${p.documentNumber}`.trim() : null);

/** Fila del listado. */
function aResumen(f) {
  const perfil = f.customer?.profile;
  return {
    documentId: f.documentId,
    numero: f.fullNumber ?? null,
    estado: f.state,
    pago: f.paymentState,
    total: f.amount ?? 0,
    moneda: f.currency ?? 'COP',
    emitidaEl: f.issuedAt ?? null,
    creadaEl: f.createdAt,
    cliente: f.customer
      ? { documentId: f.customer.documentId, nombre: f.buyer?.name ?? nombre(perfil), documento: documento(perfil) }
      : null,
  };
}

function aRenglon(r) {
  const c = r.sourceConsultation;
  return {
    documentId: r.documentId,
    kind: r.kind,
    descripcion: r.description,
    cantidad: Number(r.quantity),
    unidad: r.unit,
    precioUnitario: r.unitPrice ?? 0,
    descuento: r.discountAmount ?? 0,
    tratamiento: r.taxTreatment,
    tarifa: r.taxRate ?? 0,
    subtotal: r.lineSubtotal ?? 0,
    impuesto: r.lineTax ?? 0,
    total: r.lineTotal ?? 0,
    // Un renglón de consulta toma su cantidad de la línea: no se edita aquí.
    cantidadEditable: !String(r.kind).startsWith('consultation_'),
    retenida: Boolean(r.lockKey),
    consulta: c ? { documentId: c.documentId, fecha: c.consultedAt, mascota: c.pet?.name ?? null } : null,
  };
}

/** Qué se puede buscar en `q`: número, nombre o documento (vía searchLabel). */
const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

module.exports = ({ strapi }) => {
  const invoicing = () => strapi.service('api::billing.invoicing');

  async function detalle(documentId) {
    const f = await strapi.documents(FACTURA).findOne({
      documentId,
      populate: {
        customer: { populate: ['profile'] },
        buyer: true,
        subscription: { fields: ['searchLabel'] },
        items: {
          sort: 'sortOrder:asc',
          populate: { sourceConsultation: { fields: ['consultedAt'], populate: { pet: { fields: ['name'] } } } },
        },
      },
      // Una factura archivada también se abre desde su enlace.
      filters: { $or: [{ archivedAt: { $null: true } }, { archivedAt: { $notNull: true } }] },
    });
    if (!f) return null;
    return {
      ...aResumen(f),
      subtotal: f.subtotal ?? 0,
      descuentos: f.discountTotal ?? 0,
      impuesto: f.taxTotal ?? 0,
      notas: f.notes ?? null,
      venceEl: f.dueOn ?? null,
      anuladaEl: f.voidedAt ?? null,
      motivoAnulacion: f.voidReason ?? null,
      archivada: Boolean(f.archivedAt),
      comprador: f.buyer ?? null,
      resolucion: f.resolutionNumber
        ? { numero: f.resolutionNumber, desde: f.resolutionRangeFrom, hasta: f.resolutionRangeTo, vigenteHasta: f.resolutionValidUntil }
        : null,
      suscripcion: f.subscription ? { documentId: f.subscription.documentId, etiqueta: f.subscription.searchLabel } : null,
      renglones: (f.items ?? []).map(aRenglon),
    };
  }

  /** El renglón, comprobando que es de esa factura (la ruta trae las dos). */
  async function renglonDe(facturaId, renglonId) {
    const r = await strapi.documents(RENGLON).findOne({
      documentId: renglonId,
      populate: { invoice: { fields: ['documentId'] } },
    });
    if (!r || r.invoice?.documentId !== facturaId) return null;
    return r;
  }

  return {
    detalle,
    renglonDe,

    pendientes: (q) => invoicing().pendientes({ desde: texto(q.desde), hasta: texto(q.hasta), cliente: texto(q.cliente) }),

    estadoConsulta: (id) => invoicing().estadoDeConsulta(id),

    async listar(q) {
      const pagina = Math.max(1, Number(q.page) || 1);
      const porPagina = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
      const and = [];
      if (texto(q.estado)) and.push({ state: q.estado });
      if (texto(q.pago)) and.push({ paymentState: q.pago });
      if (texto(q.cliente)) and.push({ customer: { documentId: q.cliente } });
      if (texto(q.q)) and.push({ searchLabel: { $containsi: q.q.trim() } });
      // Una emitida se ubica por su fecha de emisión; un borrador, por la de creación.
      if (texto(q.desde) || texto(q.hasta)) {
        const rango = {
          ...(texto(q.desde) ? { $gte: `${q.desde}T00:00:00.000Z` } : {}),
          ...(texto(q.hasta) ? { $lte: `${q.hasta}T23:59:59.999Z` } : {}),
        };
        and.push({ $or: [{ issuedAt: rango }, { issuedAt: { $null: true }, createdAt: rango }] });
      }
      const filters = and.length > 0 ? { $and: and } : {};

      const [filas, total] = await Promise.all([
        strapi.documents(FACTURA).findMany({
          filters,
          populate: { customer: { populate: ['profile'] }, buyer: true },
          sort: ['createdAt:desc'],
          start: (pagina - 1) * porPagina,
          limit: porPagina,
        }),
        strapi.documents(FACTURA).count({ filters }),
      ]);
      return {
        data: filas.map(aResumen),
        paginacion: { pagina, porPagina, total, paginas: Math.max(1, Math.ceil(total / porPagina)) },
      };
    },

    async buscarClientes(q) {
      const t = texto(q);
      const clientes = await strapi.documents('api::customer.customer').findMany({
        filters: t ? { searchLabel: { $containsi: t } } : {},
        fields: ['searchLabel'],
        sort: ['searchLabel:asc'],
        limit: 15,
      });
      return clientes.map((c) => ({ documentId: c.documentId, etiqueta: c.searchLabel }));
    },

    /** Servicios y productos activos, para añadir un concepto sin consulta. */
    async buscarCatalogo(q) {
      const t = texto(q);
      const [servicios, productos] = await Promise.all([
        strapi.documents('api::scheduling.service').findMany({
          filters: { isActive: { $ne: false }, ...(t ? { name: { $containsi: t } } : {}) },
          populate: ['tax'],
          sort: ['name:asc'],
          limit: 10,
        }),
        strapi.documents('api::catalog.product').findMany({
          filters: { isActive: { $ne: false }, ...(t ? { searchLabel: { $containsi: t } } : {}) },
          populate: ['tax'],
          sort: ['name:asc'],
          limit: 10,
        }),
      ]);
      // `problema` avisa antes de intentar añadirlo: la regla lo rechazaría.
      const problema = (precio, tax) =>
        precio == null ? 'sin precio de venta' : !tax?.ivaTreatment ? 'sin perfil tributario (IVA)' : null;
      return [
        ...servicios.map((s) => ({ relacion: 'service', documentId: s.documentId, nombre: s.name, precio: s.basePrice ?? null, problema: problema(s.basePrice, s.tax) })),
        ...productos.map((p) => ({ relacion: 'product', documentId: p.documentId, nombre: p.searchLabel || p.name, precio: p.salePrice ?? null, problema: problema(p.salePrice, p.tax) })),
      ];
    },

    async crear({ cliente, conceptos, notas }) {
      const f = Array.isArray(conceptos) && conceptos.length > 0
        ? await invoicing().crearBorrador({ cliente, conceptos, notas })
        : await invoicing().crearVacia({ cliente, notas });
      return detalle(f.documentId);
    },

    async agregar(id, { conceptos, directo }) {
      if (Array.isArray(conceptos) && conceptos.length > 0) await invoicing().agregarConceptos(id, conceptos);
      else if (directo) await invoicing().agregarDirecto(id, directo);
      return detalle(id);
    },

    async actualizarBorrador(id, { notas, venceEl }) {
      const data = {};
      if (notas !== undefined) data.notes = notas || null;
      if (venceEl !== undefined) data.dueOn = venceEl || null;
      await strapi.documents(FACTURA).update({ documentId: id, data });
      return detalle(id);
    },

    async actualizarRenglon(id, renglonId, cambios) {
      const data = {};
      if (cambios.descuento !== undefined) data.discountAmount = Number(cambios.descuento) || 0;
      if (cambios.precioUnitario !== undefined) data.unitPrice = Number(cambios.precioUnitario);
      if (cambios.cantidad !== undefined) data.quantity = Number(cambios.cantidad);
      await strapi.documents(RENGLON).update({ documentId: renglonId, data });
      return detalle(id);
    },

    async quitarRenglon(id, renglonId) {
      await strapi.documents(RENGLON).delete({ documentId: renglonId });
      return detalle(id);
    },

    borrar: (id) => strapi.documents(FACTURA).delete({ documentId: id }),

    async emitir(id, { venceEl }) {
      await invoicing().emitir(id, { dueOn: venceEl || undefined });
      return detalle(id);
    },

    async pago(id, estado) {
      await strapi.documents(FACTURA).update({ documentId: id, data: { paymentState: estado } });
      return detalle(id);
    },

    async anular(id, motivo) {
      await strapi.documents(FACTURA).update({ documentId: id, data: { state: 'voided', voidReason: motivo } });
      return detalle(id);
    },

    pdf: (id) => strapi.service('api::billing.invoice-pdf').generar(id),
  };
};
