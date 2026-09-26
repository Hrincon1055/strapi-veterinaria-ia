import type { Core } from '@strapi/strapi';
import { ValidationError, effective, loadCurrent, on, toDocumentId } from './helpers';

/**
 * Reglas de los requisitos de viaje.
 *
 * `requirements` pasó de ser un componente repetible con un nombre de texto a
 * una dynamic zone de siete tipos, cada uno con sus propios datos. La regla de
 * fondo no cambia —un requisito cumplido necesita quién lo verificó— pero
 * ahora, al estar tipados, se pueden comprobar cosas que antes eran texto
 * libre: que la titulación antirrábica alcance el umbral, o que un documento
 * no esté caducado para la fecha del vuelo.
 */

/** Nombre legible del requisito, para que el error diga cuál falla. */
function nombreDe(req: any): string {
  switch (req?.__component) {
    case 'travel.health-certificate':
      return 'Certificado zoosanitario';
    case 'travel.rabies-titer':
      return 'Titulación antirrábica';
    case 'travel.microchip-check':
      return 'Verificación de microchip';
    case 'travel.antiparasitic':
      return 'Tratamiento antiparasitario';
    case 'travel.import-permit':
      return 'Permiso de importación';
    case 'travel.crate':
      return 'Guacal de transporte';
    default:
      return req?.requirementName || 'Requisito';
  }
}

/** Campo de caducidad de cada tipo, si lo tiene. */
const CADUCIDAD: Record<string, string> = {
  'travel.health-certificate': 'validUntil',
  'travel.rabies-titer': 'validUntil',
  'travel.import-permit': 'expiresOn',
};

export default (strapi: Core.Strapi): void => {
  on(strapi, 'api::travel.travel-case', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    if (!('requirements' in data)) return next();

    const current = await loadCurrent(strapi, ctx, ['requirements']);
    const previos: any[] = current?.requirements ?? [];
    const requisitos = data.requirements;
    if (!Array.isArray(requisitos)) return next();

    const travelOn = effective<string>(data, current, 'travelOn');

    for (const req of requisitos) {
      const nombre = nombreDe(req);

      // Un umbral que no se alcanza no es un requisito cumplido, aunque
      // alguien marque la casilla.
      if (req.__component === 'travel.rabies-titer' && req.resultIuMl != null) {
        const umbral = req.thresholdIuMl ?? 0.5;
        if (Number(req.resultIuMl) < Number(umbral)) {
          if (req.isCompleted === true) {
            throw new ValidationError(
              `La titulación antirrábica (${req.resultIuMl} UI/ml) no alcanza el umbral exigido (${umbral} UI/ml)`
            );
          }
        }
      }

      // Un documento que caduca antes del vuelo no sirve para ese vuelo.
      const campoCaducidad = CADUCIDAD[req.__component];
      if (campoCaducidad && req[campoCaducidad] && travelOn) {
        if (String(req[campoCaducidad]) < String(travelOn).slice(0, 10)) {
          throw new ValidationError(
            `${nombre} caduca el ${req[campoCaducidad]}, antes de la fecha de viaje (${String(travelOn).slice(0, 10)})`
          );
        }
      }

      if (req?.isCompleted !== true) continue;

      if (!toDocumentId(req.verifiedBy)) {
        throw new ValidationError(`"${nombre}" no puede marcarse como cumplido sin quién lo verificó`);
      }

      // Se sella el momento de verificación al pasar a cumplido.
      const antes = previos.find((p) => p.id === req.id);
      if (!req.verifiedAt && (!antes || antes.isCompleted !== true)) {
        req.verifiedAt = new Date().toISOString();
      }
    }

    ctx.params.data = data;
    return next();
  });
};
