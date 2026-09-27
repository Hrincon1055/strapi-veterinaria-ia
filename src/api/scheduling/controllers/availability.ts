import { errors } from '@strapi/utils';

const { ValidationError } = errors;

/**
 * GET /api/availability?staff=<documentId>&desde=&hasta=[&servicio=<documentId>]
 *
 * Devuelve los huecos libres de un profesional. Si se indica un servicio, la
 * duración del hueco sale de `service.defaultDurationMinutes` en vez del
 * horario: una consulta de 45 minutos y una vacunación de 15 no generan la
 * misma rejilla.
 */
export default {
  async find(ctx: any) {
    const { staff, desde, hasta, servicio } = ctx.query ?? {};

    if (!staff) throw new ValidationError('Falta el parámetro "staff" (documentId del profesional)');
    // `date-range` ya validó el formato y que el rango no esté invertido.
    const rango = ctx.state?.rango ?? {};
    if (!rango.desde || !rango.hasta) {
      throw new ValidationError('Faltan "desde" y "hasta" (AAAA-MM-DD)');
    }

    let duracion: number | undefined;
    if (servicio) {
      const s = await strapi.documents('api::scheduling.service').findOne({
        documentId: String(servicio),
      });
      if (!s) throw new ValidationError(`No existe el servicio ${servicio}`);
      duracion = (s as any).defaultDurationMinutes;
    }

    const datos = await strapi
      .service('api::scheduling.availability')
      .huecos(String(staff), rango.desde, rango.hasta, duracion);

    ctx.body = { data: datos };
  },
};
