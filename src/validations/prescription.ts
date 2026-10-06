import type { Core } from '@strapi/strapi';
import { ValidationError, on } from './helpers';
import { estaEnServicioDeFormulas } from '../api/clinical/domain/formula';

/**
 * Fórmula médica (`api::clinical.prescription`).
 *
 *  - Solo la crea y la anula `api::clinical.prescribing`, que le pone el
 *    consecutivo y la copia del firmante y de los medicamentos. Creada o
 *    editada a mano (Content Manager, API) saldría un número repetido o la
 *    tarjeta profesional de otra persona.
 *  - Emitida = congelada. Lo único que cambia después es la anulación, con
 *    motivo, y también la hace el servicio.
 *  - No se borra: una fórmula ya entregada sigue existiendo en la farmacia
 *    aunque aquí desaparezca. Se anula. La única excepción es dentro de la
 *    marca, que usan los scripts de demo y de prueba para limpiar lo suyo:
 *    borrar con el query engine dejaría huérfanos los renglones
 *    (`clinical.prescription-item`), que solo el Document Service borra.
 *
 * La escritura que solo trae `searchLabel` es la de `validations/labels.ts` y
 * se deja pasar.
 */

const FORMULA = 'api::clinical.prescription';

const soloEtiqueta = (data: any): boolean => !!data && Object.keys(data).length === 1 && 'searchLabel' in data;

export default (strapi: Core.Strapi): void => {
  on(strapi, FORMULA, ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    if (ctx.action === 'update' && soloEtiqueta(data)) return next();

    if (!estaEnServicioDeFormulas()) {
      throw new ValidationError(
        ctx.action === 'create'
          ? 'Las fórmulas médicas se emiten desde la consulta (panel "Fórmula médica"), no se crean a mano'
          : 'Una fórmula emitida no se edita: si hay que corregirla, se anula desde la consulta y se emite otra'
      );
    }

    if (ctx.action === 'create') {
      if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new ValidationError('Una fórmula necesita al menos un medicamento');
      }
      if (!data.vetLicense) throw new ValidationError('Una fórmula necesita la tarjeta profesional de quien la firma');
      return next();
    }

    // Dentro del servicio, una actualización solo puede ser la anulación.
    const actual: any = await strapi.documents(FORMULA as any).findOne({ documentId: ctx.params.documentId, fields: ['state'] as any } as any);
    const claves = Object.keys(data).filter((k) => !['state', 'voidReason', 'voidedAt'].includes(k));
    if (actual?.state !== 'issued' || data.state !== 'voided' || !data.voidReason || claves.length > 0) {
      throw new ValidationError('Una fórmula emitida solo puede anularse, con motivo');
    }
    return next();
  });

  on(strapi, FORMULA, ['delete'], async (_ctx, next) => {
    if (!estaEnServicioDeFormulas()) throw new ValidationError('Una fórmula médica no se borra: se anula');
    return next();
  });
};
