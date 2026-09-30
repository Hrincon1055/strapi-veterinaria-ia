import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { includeArchived } from '../../../validations/archived';
import { calcularRenglon } from '../domain/calculo';
import { enEmision } from '../domain/emision';
import { conCambioDePrecio } from '../domain/cambio-precio';
import { CATALOGOS, LINEAS_FACTURABLES, TIPOS_DE_RENGLON } from '../domain/fuentes';
import { comprador, emisor } from '../domain/instantaneas';

const { ValidationError } = errors;

/**
 * Facturación desde la consulta: qué se puede cobrar, qué falta por cobrar y
 * crear el borrador con lo elegido.
 *
 * No valida nada por su cuenta: crea los renglones por el Document Service y
 * deja que `validations/billing.ts` decida (línea facturable, del cliente,
 * no cobrada ya). Así la regla es la misma entre el panel, este servicio y
 * cualquier integración, y aquí solo se orquesta. Lo usará el plugin de
 * facturación del panel, igual que la agenda usa `availability`.
 */

const FACTURA = 'api::billing.invoice';
const RENGLON = 'api::billing.invoice-item';
const CONSULTA = 'api::clinical.consultation';

/** Qué `kind` de renglón corresponde a cada tarjeta de la consulta. */
const KIND_DE_COMPONENTE: Record<string, string> = Object.fromEntries(
  Object.entries(TIPOS_DE_RENGLON)
    .filter(([, t]) => t.componente)
    .map(([kind, t]) => [t.componente as string, kind])
);

const POPULATE_CONSULTA = {
  pet: { populate: { owner: { populate: ['profile'] } } },
  lines: {
    on: {
      'clinical.service-line': { populate: { service: { populate: ['tax'] } } },
      'clinical.product-line': { populate: { product: { populate: ['tax'] } } },
    },
  },
};

export type EstadoLinea = 'pendiente' | 'facturada' | 'no_facturable';

const nombre = (p: any): string | null => (p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || null : null);

/** Por qué una línea no se puede cobrar (o null si se puede). */
function motivoNoFacturable(linea: any): string | null {
  const regla = LINEAS_FACTURABLES[linea.__component];
  if (!regla) return 'tipo de línea no facturable';
  if (!regla.facturable(linea)) return `estado "${linea.state}"`;
  return null;
}

/**
 * Precio que tendría la línea con el catálogo de hoy. Es una estimación: el
 * renglón copia el precio al crearse y desde ahí no cambia. `problema` dice
 * qué falta en el catálogo para poder cobrarla.
 */
function estimar(linea: any): { unitPrice: number | null; lineTotal: number | null; problema: string | null } {
  const regla = LINEAS_FACTURABLES[linea.__component];
  const destino = regla ? linea[regla.relacion] : null;
  if (!destino) return { unitPrice: null, lineTotal: null, problema: 'sin servicio o producto' };
  const precio = destino[CATALOGOS[regla.relacion].precio as string];
  if (precio == null) return { unitPrice: null, lineTotal: null, problema: 'sin precio de venta en el catálogo' };
  if (!destino.tax?.ivaTreatment) return { unitPrice: precio, lineTotal: null, problema: 'sin perfil tributario (IVA) en el catálogo' };
  const c = calcularRenglon({
    quantity: linea.quantity,
    unitPrice: precio,
    taxTreatment: destino.tax.ivaTreatment,
    taxRate: destino.tax.ivaRate,
  });
  return { unitPrice: precio, lineTotal: c.lineTotal, problema: null };
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  /** Renglones que cobran líneas de estas consultas, vivos y anulados. */
  async function renglonesDe(consultaIds: string[]): Promise<any[]> {
    if (consultaIds.length === 0) return [];
    return strapi.documents(RENGLON as any).findMany({
      filters: { sourceConsultation: { documentId: { $in: consultaIds } } } as any,
      fields: ['sourceLineKey', 'lockKey', 'lineTotal'] as any,
      populate: {
        sourceConsultation: { fields: ['documentId'] },
        invoice: { fields: ['documentId', 'fullNumber', 'state', 'searchLabel'], filters: includeArchived(FACTURA) },
      } as any,
    } as any);
  }

  /** Estado de facturación de una consulta ya cargada, dados sus renglones. */
  function construirEstado(consulta: any, renglones: any[]) {
    const propios = renglones.filter((r) => r.sourceConsultation?.documentId === consulta.documentId);
    const vivos = new Map(propios.filter((r) => r.lockKey).map((r) => [r.lockKey, r]));

    const lineas = (consulta.lines ?? [])
      .filter((l: any) => LINEAS_FACTURABLES[l.__component])
      .map((l: any) => {
        const regla = LINEAS_FACTURABLES[l.__component];
        const destino = l[regla.relacion];
        const vivo = vivos.get(l.lineKey);
        const motivo = motivoNoFacturable(l);
        const estado: EstadoLinea = vivo ? 'facturada' : motivo ? 'no_facturable' : 'pendiente';
        return {
          lineKey: l.lineKey,
          componente: l.__component,
          kind: KIND_DE_COMPONENTE[l.__component],
          label: l.label,
          state: l.state,
          quantity: Number(l.quantity),
          [regla.relacion]: destino ? { documentId: destino.documentId, name: destino.name } : null,
          estado,
          motivo,
          estimado: estado === 'pendiente' ? estimar(l) : null,
          factura: vivo?.invoice
            ? { documentId: vivo.invoice.documentId, fullNumber: vivo.invoice.fullNumber, state: vivo.invoice.state }
            : null,
          // Facturas anuladas que la cobraron antes: trazabilidad.
          anteriores: propios
            .filter((r) => !r.lockKey && r.sourceLineKey === l.lineKey && r.invoice)
            .map((r) => ({ documentId: r.invoice.documentId, fullNumber: r.invoice.fullNumber, state: r.invoice.state })),
        };
      });

    const cobrables = lineas.filter((l: any) => l.estado !== 'no_facturable');
    const facturadas = cobrables.filter((l: any) => l.estado === 'facturada').length;
    const resumen =
      cobrables.length === 0 ? 'sin_conceptos'
        : facturadas === 0 ? 'sin_facturar'
          : facturadas === cobrables.length ? 'facturada'
            : 'parcial';

    const owner = consulta.pet?.owner;
    return {
      consulta: {
        documentId: consulta.documentId,
        consultedAt: consulta.consultedAt,
        reason: consulta.reason,
        archivada: !!consulta.archivedAt,
      },
      mascota: consulta.pet ? { documentId: consulta.pet.documentId, name: consulta.pet.name } : null,
      cliente: owner ? { documentId: owner.documentId, nombre: nombre(owner.profile) } : null,
      resumen,
      pendientes: lineas.filter((l: any) => l.estado === 'pendiente').length,
      valorPendiente: lineas
        .filter((l: any) => l.estado === 'pendiente')
        .reduce((s: number, l: any) => s + (l.estimado?.lineTotal ?? 0), 0),
      lineas,
    };
  }

  /**
   * Convierte `{ consulta, lineKey }` en los datos de un renglón. El `kind`
   * depende de la tarjeta de la línea. Lo demás (que sea facturable, del
   * cliente y no esté cobrada) lo decide la regla del renglón al crearlo.
   */
  async function renglonesDeConceptos(
    conceptos: Array<{ consulta: string; lineKey: string; discountAmount?: number }>,
    ordenInicial: number
  ) {
    if (!Array.isArray(conceptos) || conceptos.length === 0) {
      throw new ValidationError('Elige al menos un concepto para facturar');
    }
    const claves = conceptos.map((c) => c.lineKey);
    if (new Set(claves).size !== claves.length) {
      throw new ValidationError('Hay un concepto repetido en la selección');
    }

    const consultaIds = [...new Set(conceptos.map((c) => c.consulta))];
    const consultas: any[] = await strapi.documents(CONSULTA as any).findMany({
      filters: { documentId: { $in: consultaIds } } as any,
      populate: { pet: { populate: ['owner'] }, lines: { on: { 'clinical.service-line': true, 'clinical.product-line': true } } } as any,
    } as any);
    const porId = new Map(consultas.map((c) => [c.documentId, c]));

    const renglones = conceptos.map((c, i) => {
      const consulta = porId.get(c.consulta);
      if (!consulta) throw new ValidationError(`La consulta ${c.consulta} no existe o está archivada`);
      const linea = (consulta.lines ?? []).find((l: any) => l.lineKey === c.lineKey);
      if (!linea) throw new ValidationError(`La línea ${c.lineKey} no está en la consulta ${c.consulta}`);
      const kind = KIND_DE_COMPONENTE[linea.__component];
      if (!kind) throw new ValidationError(`Una línea "${linea.__component}" no se factura`);
      return {
        kind,
        sourceConsultation: c.consulta,
        sourceLineKey: c.lineKey,
        discountAmount: c.discountAmount ?? 0,
        sortOrder: ordenInicial + i,
      };
    });

    return { renglones, duenoDeLaPrimera: porId.get(conceptos[0].consulta)?.pet?.owner?.documentId as string | undefined };
  }

  /** Orden para el próximo renglón: detrás del último. */
  async function siguienteOrden(facturaDocumentId: string): Promise<number> {
    const ultimos: any[] = await strapi.documents(RENGLON as any).findMany({
      filters: { invoice: { documentId: facturaDocumentId } } as any,
      fields: ['sortOrder'] as any,
      sort: 'sortOrder:desc',
      limit: 1,
    } as any);
    return ultimos.length > 0 ? Number(ultimos[0].sortOrder ?? 0) + 1 : 0;
  }

  const conRenglones = (facturaDocumentId: string) =>
    strapi.documents(FACTURA as any).findOne({
      documentId: facturaDocumentId,
      populate: { items: { sort: 'sortOrder:asc' }, customer: true } as any,
    } as any);

  return {
    /**
     * Qué conceptos tiene la consulta y en qué punto de cobro está cada uno:
     * pendiente, facturada (y en qué factura) o no facturable (y por qué).
     */
    async estadoDeConsulta(consultaDocumentId: string) {
      const consulta: any = await strapi.documents(CONSULTA as any).findOne({
        documentId: consultaDocumentId,
        populate: POPULATE_CONSULTA as any,
        filters: includeArchived(CONSULTA) as any,
      } as any);
      if (!consulta) return null;
      return construirEstado(consulta, await renglonesDe([consulta.documentId]));
    },

    /**
     * Bandeja: consultas con algún concepto pendiente de cobro, la más
     * reciente primero. `desde`/`hasta` (AAAA-MM-DD) filtran por fecha de la
     * consulta; `cliente` por documentId del cliente.
     */
    async pendientes({ desde, hasta, cliente, limite = 200 }: { desde?: string; hasta?: string; cliente?: string; limite?: number } = {}) {
      const filters: any = {};
      if (desde || hasta) {
        filters.consultedAt = {
          ...(desde ? { $gte: `${desde}T00:00:00.000Z` } : {}),
          ...(hasta ? { $lte: `${hasta}T23:59:59.999Z` } : {}),
        };
      }
      if (cliente) filters.pet = { owner: { documentId: cliente } };

      const consultas: any[] = await strapi.documents(CONSULTA as any).findMany({
        filters,
        populate: POPULATE_CONSULTA as any,
        sort: 'consultedAt:desc',
        limit: limite,
      } as any);

      const renglones = await renglonesDe(consultas.map((c) => c.documentId));
      return consultas
        .map((c) => construirEstado(c, renglones))
        .filter((e) => e.pendientes > 0)
        .map(({ lineas, ...resto }) => resto);
    },

    /**
     * Crea un borrador con los conceptos elegidos, todo o nada.
     *
     * `conceptos`: líneas de consulta, como `{ consulta, lineKey }`; pueden ser
     * de varias consultas si todas son de mascotas del mismo cliente (D1).
     * `cliente` es opcional: si falta, es el dueño de la primera consulta.
     * Descuento por renglón opcional (`discountAmount`).
     */
    async crearBorrador({
      cliente,
      conceptos,
      notas,
    }: {
      cliente?: string;
      conceptos: Array<{ consulta: string; lineKey: string; discountAmount?: number }>;
      notas?: string;
    }) {
      const { renglones, duenoDeLaPrimera } = await renglonesDeConceptos(conceptos, 0);
      const clienteId = cliente ?? duenoDeLaPrimera;
      if (!clienteId) throw new ValidationError('No se pudo determinar el cliente de la factura');

      // Si un renglón falla (línea ya cobrada, sin precio, de otro cliente…)
      // no queda un borrador a medias.
      return strapi.db.transaction(async () => {
        const factura: any = await strapi.documents(FACTURA as any).create({
          data: { customer: clienteId, ...(notas ? { notes: notas } : {}) } as any,
        });
        for (const r of renglones) {
          await strapi.documents(RENGLON as any).create({ data: { ...r, invoice: factura.documentId } as any });
        }
        return conRenglones(factura.documentId);
      });
    },

    /**
     * Borrador sin renglones, para una venta que no sale de una consulta
     * (alimento o accesorios en mostrador). Los conceptos se añaden después.
     */
    async crearVacia({ cliente, notas }: { cliente: string; notas?: string }) {
      if (!cliente) throw new ValidationError('Indica el cliente de la factura');
      const factura: any = await strapi.documents(FACTURA as any).create({
        data: { customer: cliente, ...(notas ? { notes: notas } : {}) } as any,
      });
      return conRenglones(factura.documentId);
    },

    /** Añade líneas de consulta a un borrador existente, todo o nada. */
    async agregarConceptos(facturaDocumentId: string, conceptos: Array<{ consulta: string; lineKey: string; discountAmount?: number }>) {
      const siguiente = await siguienteOrden(facturaDocumentId);
      const { renglones } = await renglonesDeConceptos(conceptos, siguiente);
      return strapi.db.transaction(async () => {
        for (const r of renglones) {
          await strapi.documents(RENGLON as any).create({ data: { ...r, invoice: facturaDocumentId } as any });
        }
        return conRenglones(facturaDocumentId);
      });
    },

    /**
     * Añade un servicio o producto del catálogo que no sale de una consulta.
     * Precio e impuesto los copia la regla del renglón desde el catálogo.
     */
    async agregarDirecto(
      facturaDocumentId: string,
      { relacion, documentId, quantity = 1, discountAmount = 0 }: { relacion: 'service' | 'product'; documentId: string; quantity?: number; discountAmount?: number }
    ) {
      if (!['service', 'product'].includes(relacion) || !documentId) {
        throw new ValidationError('Indica el servicio o producto del catálogo');
      }
      await strapi.documents(RENGLON as any).create({
        data: {
          invoice: facturaDocumentId,
          kind: relacion === 'service' ? 'direct_service' : 'direct_product',
          [relacion]: documentId,
          quantity,
          discountAmount,
          sortOrder: await siguienteOrden(facturaDocumentId),
        } as any,
      });
      return conRenglones(facturaDocumentId);
    },

    /**
     * Cambia el precio de catálogo de un renglón (D5), con motivo. Quien
     * llama ya comprobó el permiso `facturacion.cambiar-precio`; la regla del
     * renglón solo acepta un precio distinto dentro de esta marca.
     */
    cambiarPrecio(renglonDocumentId: string, { unitPrice, motivo }: { unitPrice: number; motivo: string }) {
      return conCambioDePrecio(() =>
        strapi.documents(RENGLON as any).update({
          documentId: renglonDocumentId,
          data: { unitPrice, priceOverrideReason: motivo } as any,
        })
      );
    },

    /**
     * Emite un borrador: le asigna el siguiente consecutivo de la resolución
     * activa de Clínica y congela los datos del receptor, del emisor y de la
     * resolución (D2).
     *
     * El consecutivo sube con un único UPDATE condicional sobre la fila de la
     * resolución (`current_number < range_to`) dentro de la misma transacción
     * que escribe la factura: dos emisiones simultáneas no pueden tomar el
     * mismo número, y si escribir la factura falla el número no se pierde.
     * El índice `ux_invoices_full_number` es la última defensa.
     *
     * `currentNumber` es "último número usado": vacío significa que la
     * resolución no se ha estrenado y el primero será `rangeFrom`.
     */
    async emitir(facturaDocumentId: string, { dueOn }: { dueOn?: string } = {}) {
      const factura: any = await strapi.documents(FACTURA as any).findOne({
        documentId: facturaDocumentId,
        populate: {
          customer: { populate: { profile: { populate: { addresses: { populate: ['country'] }, contacts: true } } } },
        } as any,
      } as any);
      if (!factura) throw new ValidationError('La factura no existe');
      if (factura.state !== 'draft') {
        throw new ValidationError(`Solo se emite un borrador; esta factura está en estado "${factura.state}"`);
      }

      const clinica: any = await strapi.documents('api::clinic.clinic' as any).findFirst({
        populate: {
          logo: true,
          fiscalAddress: { populate: ['country'] },
          fiscalResponsibilities: true,
          resolutions: true,
        } as any,
      } as any);
      if (!clinica) throw new ValidationError('Faltan los datos de la clínica (Clínica): son el emisor de la factura');

      const hoy = new Date().toISOString().slice(0, 10);
      const activa = (clinica.resolutions ?? []).find((r: any) => r.isActive === true);
      if (!activa) throw new ValidationError('No hay una resolución DIAN activa en Clínica');
      const etiqueta = `La resolución ${activa.resolutionNumber}`;
      if (activa.validFrom && String(activa.validFrom) > hoy) {
        throw new ValidationError(`${etiqueta} todavía no está vigente (desde ${activa.validFrom})`);
      }
      if (activa.validUntil && String(activa.validUntil) < hoy) {
        throw new ValidationError(`${etiqueta} venció el ${activa.validUntil}; carga la nueva en Clínica`);
      }

      const tabla = strapi.db.metadata.get('billing.dian-resolution' as any).tableName;

      return strapi.db.transaction(async ({ trx }: any) => {
        const siguiente = 'COALESCE(current_number, range_from - 1) + 1';
        const subio = await trx(tabla)
          .where({ id: activa.id })
          .whereRaw('COALESCE(current_number, range_from - 1) < range_to')
          .update({ current_number: trx.raw(siguiente) });
        if (!subio) {
          throw new ValidationError(`${etiqueta} agotó su rango autorizado; solicita una nueva a la DIAN`);
        }
        const fila = await trx(tabla).where({ id: activa.id }).first('current_number', 'range_to');
        const numero = Number(fila.current_number);
        const restantes = Number(fila.range_to) - numero;
        if (restantes <= 100) {
          strapi.log.warn(`[facturación] quedan ${restantes} números en la resolución ${activa.resolutionNumber}`);
        }

        const prefijo = activa.prefix ?? '';
        await enEmision(() =>
          strapi.documents(FACTURA as any).update({
            documentId: facturaDocumentId,
            data: {
              state: 'issued',
              prefix: prefijo || null,
              number: numero,
              fullNumber: `${prefijo}${numero}`,
              resolutionNumber: activa.resolutionNumber,
              resolutionDate: activa.resolutionDate,
              resolutionRangeFrom: activa.rangeFrom,
              resolutionRangeTo: activa.rangeTo,
              resolutionValidUntil: activa.validUntil ?? null,
              issuedAt: new Date().toISOString(),
              ...(dueOn ? { dueOn } : {}),
              buyer: comprador(factura.customer?.profile),
              issuerSnapshot: emisor(clinica),
            } as any,
          })
        );

        return strapi.documents(FACTURA as any).findOne({
          documentId: facturaDocumentId,
          populate: { items: { sort: 'sortOrder:asc' }, buyer: true, customer: true } as any,
        } as any);
      });
    },
  };
};
