import { factories } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';
import { diasConServicio } from '../domain/estancia';
import { zonaValida } from '../domain/tiempo';
import { includeArchived } from '../../../validations/archived';

/**
 * Hospitalización como origen facturable (5.6, H3–H5).
 *
 * `conceptosFacturables` es para la hospitalización lo que `consultation.lines`
 * es para la consulta: la lista de lo que se puede cobrar, cada concepto con
 * su `lineKey`. La usan la regla del renglón de factura
 * (`validations/billing.ts`) y `api::billing.invoicing`, de modo que los dos
 * ven exactamente lo mismo.
 */

const HOSPITALIZACION = 'api::hospitalization.hospitalization';
const ADMINISTRACION = 'api::hospitalization.medication-administration';

export type ConceptoHospitalizacion = {
  lineKey: string;
  kind: 'hospitalization_stay' | 'hospitalization_product';
  relacion: 'service' | 'product';
  /** El servicio o producto, con `tax` y precio (para estimar). */
  destino: any | null;
  quantity: number;
  label: string;
  facturable: boolean;
  motivo: string | null;
  /** Día de estancia (AAAA-MM-DD) o instante de la toma. */
  fecha: string;
};

const fechaHoraCorta = (v: string): string => `${String(v).slice(0, 10)} ${String(v).slice(11, 16)}`;

export default factories.createCoreService(HOSPITALIZACION as any, ({ strapi }: { strapi: Core.Strapi }) => ({
  /** Zona horaria de Clínica (días de estancia y horas de la hoja). */
  async zona(): Promise<string> {
    const clinica = await strapi.db.query('api::clinic.clinic').findOne({ select: ['timezone'] });
    return zonaValida(clinica?.timezone);
  },

  /** ¿La clínica hospitaliza? (H1) */
  async habilitada(): Promise<boolean> {
    const clinica = await strapi.db.query('api::clinic.clinic').findOne({ select: ['offersHospitalization'] });
    return clinica?.offersHospitalization === true;
  },

  /** Zona de Clínica y su servicio de hospitalización por día (H4). */
  async contextoDeEstancia(): Promise<{ zona: string; porDefecto: any | null }> {
    const clinica: any = await strapi.documents('api::clinic.clinic' as any).findFirst({
      fields: ['timezone'] as any,
      populate: { defaultHospitalizationDayService: { populate: ['tax'] } } as any,
    } as any);
    return { zona: zonaValida(clinica?.timezone), porDefecto: clinica?.defaultHospitalizationDayService ?? null };
  },

  /** Días de estancia y tomas dadas de una hospitalización, con su `lineKey`. */
  async conceptosFacturables(documentId: string, ahora: Date = new Date()): Promise<ConceptoHospitalizacion[] | null> {
    const h: any = await strapi.documents(HOSPITALIZACION as any).findOne({
      documentId,
      populate: {
        cage: { populate: { dailyService: { populate: ['tax'] } } },
        cageStays: { populate: { cage: { populate: { dailyService: { populate: ['tax'] } } } } },
      } as any,
    } as any);
    if (!h) return null;

    const { zona, porDefecto } = await this.contextoDeEstancia();

    const dias: ConceptoHospitalizacion[] = diasConServicio(h, zona, porDefecto, ahora).map((d) => ({
      lineKey: d.lineKey,
      kind: 'hospitalization_stay',
      relacion: 'service',
      destino: d.servicio,
      quantity: 1,
      label: `Hospitalización ${d.fecha}${d.jaula?.name ? ` · ${d.jaula.name}` : ''}`,
      facturable: Boolean(d.servicio),
      motivo: d.servicio ? null : 'sin servicio de hospitalización por día (ni en la jaula ni en Clínica)',
      fecha: d.fecha,
    }));

    const administraciones: any[] = await strapi.documents(ADMINISTRACION as any).findMany({
      filters: { hospitalization: { documentId }, state: 'given', lineKey: { $notNull: true } } as any,
      populate: { product: { populate: ['tax'] } } as any,
      sort: 'administeredAt:asc',
      limit: 5000,
    } as any);

    const tomas: ConceptoHospitalizacion[] = administraciones.map((a) => ({
      lineKey: a.lineKey,
      kind: 'hospitalization_product',
      relacion: 'product',
      destino: a.product ?? null,
      quantity: Number(a.quantity),
      label: `${a.product?.searchLabel || a.product?.name || 'Producto'} · ${fechaHoraCorta(a.administeredAt)}`,
      facturable: Boolean(a.product),
      motivo: a.product ? null : 'sin producto',
      fecha: a.administeredAt,
    }));

    return [...dias, ...tomas];
  },

  /** Renglones de factura viva (con `lockKey`) que cobran conceptos de esta hospitalización. */
  renglonesVivos(documentId: string): Promise<any[]> {
    return strapi.documents('api::billing.invoice-item').findMany({
      filters: { sourceHospitalization: { documentId }, lockKey: { $notNull: true } } as any,
      populate: {
        invoice: { fields: ['documentId', 'fullNumber', 'state'], filters: includeArchived('api::billing.invoice') },
        service: { fields: ['documentId'] },
        product: { fields: ['documentId'] },
      } as any,
    } as any);
  },
}));
