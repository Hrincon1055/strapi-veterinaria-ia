import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  assertNoDuplicate,
  effective,
  loadCurrent,
  on,
  porId,
  previaDe,
  relacionDeComponente,
} from './helpers';
import { digitoVerificacion } from './clinic';

/**
 * Reglas del catálogo comercial: productos, proveedores y el perfil
 * tributario que comparten productos y servicios.
 *
 * Un solo content type `product` para todo lo vendible que no es un servicio.
 * Lo que distingue un medicamento de un juguete es `productType` (columna
 * filtrable) más un bloque de datos propios en la dynamic zone `details`.
 * Añadir un tipo nuevo = un valor del enum y, si tiene datos propios, un
 * componente y una entrada en DETALLE_POR_TIPO. La consulta y la futura
 * facturación no cambian: solo ven "un producto".
 */

/** Bloque de `details` que corresponde a cada tipo; null = no lleva. */
export const DETALLE_POR_TIPO: Record<string, string | null> = {
  medication: 'catalog.medication-details',
  vaccine: 'catalog.vaccine-details',
  food: 'catalog.food-details',
  toy: 'catalog.accessory-details',
  accessory: 'catalog.accessory-details',
  hygiene: null,
  supply: null,
  other: null,
};

/**
 * Tipos cuyo bloque es obligatorio: sin él un medicamento no tiene forma
 * farmacéutica ni condición de venta, y una vacuna no sabe qué vacuna clínica
 * es (lo que usará el carné al aplicarla).
 */
const DETALLE_OBLIGATORIO = ['medication', 'vaccine'];

/** Lotes y vencimientos: por defecto sí en lo que caduca. */
const CON_LOTES = ['medication', 'vaccine', 'food'];

/**
 * Tarifas de IVA vigentes en Colombia (general 19 %, diferencial 5 %). Un
 * concepto gravado a otra tarifa es casi siempre un error de digitación, y la
 * DIAN rechazaría la factura; si la ley cambia, se cambia aquí.
 */
const TARIFAS_IVA = [5, 19];

const NOMBRE_DETALLE: Record<string, string> = {
  'catalog.medication-details': 'Datos de medicamento',
  'catalog.vaccine-details': 'Datos de vacuna',
  'catalog.food-details': 'Datos de alimento',
  'catalog.accessory-details': 'Datos de juguete o accesorio',
};

/**
 * Gravado exige una tarifa válida; exento (tarifa 0 con derecho a
 * devolución) y excluido (fuera del impuesto) no llevan tarifa, y se deja en
 * 0 para que la factura no tenga que adivinar.
 */
export function validarImpuesto(tax: any): void {
  if (!tax || typeof tax !== 'object') return;
  const tratamiento = tax.ivaTreatment ?? 'gravado';
  if (tratamiento === 'gravado') {
    if (!TARIFAS_IVA.includes(Number(tax.ivaRate))) {
      throw new ValidationError(
        `Un concepto gravado con IVA necesita una tarifa válida (${TARIFAS_IVA.join(' o ')} %)`
      );
    }
  } else {
    if (tax.ivaRate != null && Number(tax.ivaRate) !== 0) {
      throw new ValidationError(`Un concepto ${tratamiento} de IVA no lleva tarifa`);
    }
    tax.ivaRate = 0;
  }
}

/** Populate de `details` con lo que las reglas necesitan leer. */
const DETALLES_ACTUALES = {
  on: {
    'catalog.medication-details': true,
    'catalog.vaccine-details': { populate: ['vaccine'] },
    'catalog.food-details': true,
    'catalog.accessory-details': true,
  },
};

export default (strapi: Core.Strapi): void => {
  // ---- api::catalog.product ------------------------------------------------

  on(strapi, 'api::catalog.product', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, { details: DETALLES_ACTUALES });

    const tipo = effective<string>(data, current, 'productType');

    if ('details' in data || 'productType' in data) {
      const detalles: any[] = effective<any[]>(data, current, 'details') ?? [];
      const esperado = tipo ? DETALLE_POR_TIPO[tipo] : undefined;

      if (detalles.length > 1) {
        throw new ValidationError('Un producto lleva un solo bloque de datos específicos');
      }

      const bloque = detalles[0];
      if (bloque) {
        if (esperado === null) {
          throw new ValidationError(`Un producto de tipo "${tipo}" no lleva datos específicos`);
        }
        if (esperado && bloque.__component !== esperado) {
          throw new ValidationError(
            `Un producto de tipo "${tipo}" lleva "${NOMBRE_DETALLE[esperado]}", no "${NOMBRE_DETALLE[bloque.__component] ?? bloque.__component}"`
          );
        }
      } else if (tipo && esperado && DETALLE_OBLIGATORIO.includes(tipo)) {
        throw new ValidationError(`Un producto de tipo "${tipo}" necesita "${NOMBRE_DETALLE[esperado]}"`);
      }

      // Una vacuna del catálogo es una presentación comercial de una vacuna
      // clínica: sin ese enlace no se podría llevar al carné al aplicarla.
      if (bloque?.__component === 'catalog.vaccine-details') {
        const previa = previaDe(porId(current?.details), bloque);
        if (!relacionDeComponente(bloque.vaccine, previa, 'vaccine')) {
          throw new ValidationError('Indica qué vacuna (del catálogo clínico de vacunas) es este producto');
        }
      }
    }

    if (ctx.action === 'create' && (data.tracksBatches === undefined || data.tracksBatches === null)) {
      data.tracksBatches = !!tipo && CON_LOTES.includes(tipo);
    }

    if ('tax' in data) validarImpuesto(data.tax);

    ctx.params.data = data;
    return next();
  });

  // ---- api::scheduling.service (solo el impuesto) --------------------------

  on(strapi, 'api::scheduling.service', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    if ('tax' in data) validarImpuesto(data.tax);
    return next();
  });

  // ---- api::catalog.supplier -----------------------------------------------

  on(strapi, 'api::catalog.supplier', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx);

    const tipo = effective<string>(data, current, 'documentType');
    const numero = effective<string>(data, current, 'documentNumber');
    const dv = effective<string>(data, current, 'verificationDigit');

    // Mismo módulo 11 que la clínica: el NIT del proveedor irá en los
    // documentos de compra, y un DV errado no se nota hasta que la DIAN
    // rechaza algo.
    if (tipo === 'nit' && numero && dv !== undefined && dv !== null && dv !== '') {
      const esperado = digitoVerificacion(numero);
      if (esperado !== null && String(esperado) !== String(dv)) {
        throw new ValidationError(
          `El dígito de verificación no corresponde al NIT ${numero}: debería ser ${esperado}, no ${dv}`
        );
      }
    }

    if (tipo && numero) {
      await assertNoDuplicate(
        strapi,
        'api::catalog.supplier',
        { documentType: tipo, documentNumber: numero },
        ctx.params.documentId,
        `Ya existe un proveedor con ${String(tipo).toUpperCase()} ${numero}`
      );
    }

    return next();
  });
};
