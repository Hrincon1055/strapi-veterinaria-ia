/**
 * Qué se puede cobrar y de dónde sale cada dato del renglón.
 *
 * Es el punto de extensión de la facturación, igual que `LINEAS` en
 * `validations/clinical.ts`:
 *
 * - Una categoría de producto nueva no toca nada aquí: para la factura sigue
 *   siendo "un producto" (`productType` es asunto del catálogo).
 * - Una tarjeta nueva en `consultation.lines` = una entrada en `LINEAS_FACTURABLES`
 *   y un `kind` que la apunte.
 * - Un origen nuevo fuera de la consulta = un valor del enum `kind` del
 *   renglón, una entrada en `TIPOS_DE_RENGLON` con su `origen`, la relación
 *   de origen en el renglón (`sourceHospitalization`…) y quien sepa listar
 *   sus conceptos con `lineKey` (para la hospitalización,
 *   `api::hospitalization.hospitalization.conceptosFacturables`).
 */

export type Relacion = 'service' | 'product' | 'subscription';

/** De dónde toma un renglón su precio, impuesto, unidad y costo. */
export type Catalogo = {
  uid: string;
  precio: string | null;
  /** Unidad de venta para el renglón. */
  unidad: (e: any) => string | null;
  descripcion: (e: any) => string;
  /** Costo de referencia (privado) para márgenes futuros. */
  costo: string | null;
};

export const CATALOGOS: Record<Relacion, Catalogo> = {
  service: {
    uid: 'api::scheduling.service',
    precio: 'basePrice',
    unidad: () => 'servicio',
    descripcion: (e) => e.name,
    costo: null,
  },
  product: {
    uid: 'api::catalog.product',
    precio: 'salePrice',
    unidad: (e) => e.saleUnit ?? null,
    descripcion: (e) => e.searchLabel || e.name,
    costo: 'referenceCost',
  },
  // Una suscripción no tiene un precio único (mensual o anual): el renglón
  // debe traer el suyo, y también su tratamiento de IVA.
  subscription: {
    uid: 'api::billing.subscription',
    precio: null,
    unidad: () => 'periodo',
    descripcion: (e) => e.searchLabel || 'Suscripción',
    costo: null,
  },
};

/** De dónde sale un concepto con `lineKey`, y la relación del renglón que lo señala. */
export type Origen = 'consulta' | 'hospitalizacion';

export const ORIGENES: Record<Origen, { uid: string; relacion: string }> = {
  consulta: { uid: 'api::clinical.consultation', relacion: 'sourceConsultation' },
  hospitalizacion: { uid: 'api::hospitalization.hospitalization', relacion: 'sourceHospitalization' },
};

export type TipoDeRenglon = {
  /** Relación con el catálogo que lleva el renglón, o null (cargo libre). */
  relacion: Relacion | null;
  /** Tarjeta de `consultation.lines` de la que sale, si sale de una consulta. */
  componente: string | null;
  /** Origen del concepto, o null si el renglón no cobra nada que exista fuera de él. */
  origen: Origen | null;
};

export const TIPOS_DE_RENGLON: Record<string, TipoDeRenglon> = {
  consultation_service: { relacion: 'service', componente: 'clinical.service-line', origen: 'consulta' },
  consultation_product: { relacion: 'product', componente: 'clinical.product-line', origen: 'consulta' },
  subscription: { relacion: 'subscription', componente: null, origen: null },
  direct_service: { relacion: 'service', componente: null, origen: null },
  direct_product: { relacion: 'product', componente: null, origen: null },
  custom: { relacion: null, componente: null, origen: null },
  // Hospitalización (5.6): un día de estancia y una toma dada.
  hospitalization_stay: { relacion: 'service', componente: null, origen: 'hospitalizacion' },
  hospitalization_product: { relacion: 'product', componente: null, origen: 'hospitalizacion' },
};

/**
 * Líneas de la consulta que se pueden cobrar. `recommended` nunca: es un
 * consejo, no algo que se prestó o entregó.
 */
export const LINEAS_FACTURABLES: Record<string, { relacion: Relacion; facturable: (linea: any) => boolean }> = {
  'clinical.service-line': { relacion: 'service', facturable: (l) => l.state === 'applied' },
  'clinical.product-line': { relacion: 'product', facturable: (l) => ['applied', 'dispensed'].includes(l.state) },
};
