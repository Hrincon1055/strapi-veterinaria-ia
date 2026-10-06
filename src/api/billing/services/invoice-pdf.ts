import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';
import { includeArchived } from '../../../validations/archived';
import { generarPdf, type DatosPdf } from '../domain/documento-pdf';
import { comprador, emisor } from '../domain/instantaneas';

const { ValidationError } = errors;

const FACTURA = 'api::billing.invoice';

/**
 * PDF de una factura, generado bajo demanda y nunca guardado.
 *
 * No va a la Media Library a propósito: sus archivos se sirven públicos por
 * URL y la factura lleva nombre, documento y dirección del cliente. Como la
 * factura emitida es inmutable y congeló emisor, receptor y resolución (D2),
 * regenerarla da siempre el mismo documento.
 *
 * - Emitida, anulada o con error DIAN: datos congelados al emitir.
 * - Borrador: datos actuales de Clínica y del perfil, y marca de agua; es una
 *   vista previa.
 */
export default ({ strapi }: { strapi: Core.Strapi }) => {
  /**
   * El logo como bytes. Con el proveedor local de subida la URL es relativa a
   * `public/`; con uno remoto (S3, Cloudinary) es absoluta. Si no se puede
   * leer, la factura sale sin logo en vez de fallar.
   */
  async function leerLogo(url: string | null | undefined): Promise<Buffer | null> {
    if (!url) return null;
    try {
      if (/^https?:\/\//i.test(url)) {
        const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
        return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
      }
      const publico = strapi.dirs.static.public;
      const ruta = path.resolve(publico, `.${url}`);
      if (!ruta.startsWith(path.resolve(publico))) return null;
      return await readFile(ruta);
    } catch (e: any) {
      strapi.log.warn(`[factura-pdf] no se pudo leer el logo ${url}: ${e.message}`);
      return null;
    }
  }

  return {
    /** Devuelve el PDF y un nombre de archivo sugerido. */
    async generar(facturaDocumentId: string): Promise<{ pdf: Buffer; nombreArchivo: string }> {
      const f: any = await strapi.documents(FACTURA as any).findOne({
        documentId: facturaDocumentId,
        populate: {
          buyer: true,
          customer: { populate: { profile: { populate: { addresses: { populate: ['country'] }, contacts: true } } } },
          items: {
            sort: 'sortOrder:asc',
            populate: {
              sourceConsultation: { fields: ['consultedAt'], populate: { pet: { fields: ['name'] } } },
              sourceHospitalization: { fields: ['admittedAt'], populate: { pet: { fields: ['name'] } } },
            },
          },
        } as any,
        filters: includeArchived(FACTURA) as any,
      } as any);
      if (!f) throw new ValidationError('La factura no existe');

      const borrador = f.state === 'draft';
      let datosEmisor: any;
      if (borrador) {
        const clinica: any = await strapi.documents('api::clinic.clinic' as any).findFirst({
          populate: { logo: true, fiscalAddress: { populate: ['country'] }, fiscalResponsibilities: true } as any,
        } as any);
        if (!clinica) throw new ValidationError('Faltan los datos de la clínica (Clínica)');
        datosEmisor = emisor(clinica);
      } else {
        datosEmisor = f.issuerSnapshot;
        if (!datosEmisor) throw new ValidationError(`La factura ${f.fullNumber} no tiene los datos del emisor congelados`);
      }

      const datos: DatosPdf = {
        estado: f.state,
        numero: f.fullNumber ?? null,
        emitidaEl: f.issuedAt ?? null,
        venceEl: f.dueOn ?? null,
        moneda: f.currency ?? 'COP',
        notas: f.notes ?? null,
        emisor: datosEmisor,
        comprador: borrador ? comprador(f.customer?.profile) : (f.buyer ?? {}),
        resolucion: !borrador && f.resolutionNumber
          ? {
              numero: f.resolutionNumber,
              fecha: f.resolutionDate,
              prefijo: f.prefix,
              desde: f.resolutionRangeFrom,
              hasta: f.resolutionRangeTo,
              vigenteHasta: f.resolutionValidUntil,
            }
          : null,
        renglones: (f.items ?? []).map((r: any) => {
          const consulta = r.sourceConsultation;
          const hospitalizacion = r.sourceHospitalization;
          const detalle = consulta
            ? `Consulta del ${String(consulta.consultedAt ?? '').slice(0, 10)}${consulta.pet?.name ? ` · ${consulta.pet.name}` : ''}`
            : hospitalizacion
              ? `Hospitalización desde el ${String(hospitalizacion.admittedAt ?? '').slice(0, 10)}${hospitalizacion.pet?.name ? ` · ${hospitalizacion.pet.name}` : ''}`
              : null;
          return {
            descripcion: r.description,
            detalle,
            cantidad: Number(r.quantity),
            unidad: r.unit,
            precioUnitario: r.unitPrice ?? 0,
            descuento: r.discountAmount ?? 0,
            tratamiento: r.taxTreatment,
            tarifa: r.taxRate ?? 0,
            subtotal: r.lineSubtotal ?? 0,
            impuesto: r.lineTax ?? 0,
            total: r.lineTotal ?? 0,
          };
        }),
        totales: {
          subtotal: f.subtotal ?? 0,
          descuentos: f.discountTotal ?? 0,
          impuesto: f.taxTotal ?? 0,
          total: f.amount ?? 0,
        },
        anulacion: f.state === 'voided' ? { el: f.voidedAt, motivo: f.voidReason } : null,
        logo: await leerLogo(datosEmisor.logoUrl),
      };

      return {
        pdf: await generarPdf(datos),
        nombreArchivo: borrador ? `Borrador-${f.documentId}.pdf` : `Factura-${f.fullNumber}.pdf`,
      };
    },
  };
};
