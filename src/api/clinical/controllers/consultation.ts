import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ValidationError } = errors;

export default factories.createCoreController('api::clinical.consultation', ({ strapi }) => ({
  /**
   * GET /api/consultations/search?section=clinical.diagnosis&q=gástrico
   *
   * Lo que los filtros normales no pueden hacer: buscar dentro de la dynamic
   * zone. Ver el porqué en el servicio.
   */
  async searchBySection(ctx: any) {
    const { section, q, limit } = ctx.query ?? {};

    if (!section || !q) {
      throw new ValidationError('Faltan los parámetros "section" y "q"');
    }

    // `ctx.state.rango` lo deja el middleware global::date-range, que ya
    // validó el formato y que el rango no esté invertido.
    const resultados = await strapi
      .service('api::clinical.consultation')
      .buscarPorSeccion(String(section), String(q), Number(limit) || 50, ctx.state?.rango ?? {});

    // El saneado de salida aplica los permisos del rol que pregunta: sin él
    // se devolverían campos que ese rol no puede leer.
    // Los tipos de Strapi declaran estos helpers como opcionales aunque el
    // core controller siempre los trae.
    const saneado = await this.sanitizeOutput!(resultados, ctx);
    return this.transformResponse!(saneado);
  },
}));
