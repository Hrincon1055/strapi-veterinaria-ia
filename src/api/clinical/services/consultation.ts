import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ValidationError } = errors;

/**
 * Búsqueda dentro de la historia clínica.
 *
 * Los filtros de Strapi **no atraviesan una dynamic zone**: no existe
 * `filters[sections][condition][$containsi]`, porque la zona es heterogénea y
 * el motor no sabe contra qué tabla de componente resolver el campo. Ese es el
 * precio de componer la consulta con secciones, y se paga aquí.
 *
 * La solución es bajar una capa: cada componente vive en su propia tabla
 * (`components_clinical_diagnoses`, …) y `consultations_cmps` une cada fila
 * con su consulta. Se resuelven los ids con el query engine y luego se cargan
 * los documentos completos por la vía normal, para que sigan pasando por el
 * filtro de archivados y por el saneado de salida.
 */

/** Componente -> tabla y columnas de texto donde tiene sentido buscar. */
const BUSCABLES: Record<string, { tabla: string; columnas: string[] }> = {
  'clinical.diagnosis': { tabla: 'components_clinical_diagnoses', columnas: ['condition'] },
  'clinical.procedure': { tabla: 'components_clinical_procedures', columnas: ['procedure_name'] },
  'clinical.lab-result': { tabla: 'components_clinical_lab_results', columnas: ['panel', 'laboratory'] },
  'clinical.imaging': { tabla: 'components_clinical_imagings', columnas: ['modality', 'body_region'] },
  'clinical.medication': { tabla: 'components_clinical_medications', columnas: ['drug'] },
};

export default factories.createCoreService('api::clinical.consultation', ({ strapi }) => ({
  /**
   * Consultas que tengan una sección del tipo indicado cuyo texto coincida.
   *
   * `clinical.medication` es un caso aparte: está anidado dentro de
   * `clinical.treatment-plan`, así que hay que subir dos saltos de
   * `*_cmps` para llegar a la consulta.
   */
  async buscarPorSeccion(
    componente: string,
    texto: string,
    limite = 50,
    rango: { desde?: string | null; hasta?: string | null } = {}
  ) {
    const buscable = BUSCABLES[componente];
    if (!buscable) {
      // ValidationError y no Error: un componente inexistente es culpa de
      // quien pregunta (400), no del servidor (500).
      throw new ValidationError(
        `No se puede buscar en "${componente}". Disponibles: ${Object.keys(BUSCABLES).join(', ')}`
      );
    }

    const knex = strapi.db.connection;
    const patron = `%${texto}%`;

    const condicionTexto = (constructor: any) => {
      for (const [i, col] of buscable.columnas.entries()) {
        const metodo = i === 0 ? 'whereRaw' : 'orWhereRaw';
        constructor[metodo](`lower(c.${col}) like lower(?)`, [patron]);
      }
    };

    let filas: Array<{ entity_id: number }>;

    if (componente === 'clinical.medication') {
      // medication vive dentro de treatment-plan: componente -> plan -> consulta
      filas = await knex('consultations_cmps as cc')
        .join('components_clinical_treatment_plans as tp', 'tp.id', 'cc.cmp_id')
        .join('components_clinical_treatment_plans_cmps as tpc', 'tpc.entity_id', 'tp.id')
        .join(`${buscable.tabla} as c`, 'c.id', 'tpc.cmp_id')
        .where('cc.component_type', 'clinical.treatment-plan')
        .where('tpc.component_type', componente)
        .where(condicionTexto)
        .distinct('cc.entity_id');
    } else {
      filas = await knex('consultations_cmps as cc')
        .join(`${buscable.tabla} as c`, 'c.id', 'cc.cmp_id')
        .where('cc.component_type', componente)
        .where(condicionTexto)
        .distinct('cc.entity_id');
    }

    if (filas.length === 0) return [];

    const ids = filas.map((f) => f.entity_id).slice(0, limite);

    // Los documentId se resuelven aparte: el query engine devuelve ids
    // internos, y a partir de aquí se trabaja con la API pública.
    const internas = await strapi.db
      .query('api::clinical.consultation')
      .findMany({ where: { id: { $in: ids } }, select: ['documentId'] });

    const documentIds = internas.map((c: any) => c.documentId);
    if (documentIds.length === 0) return [];

    // El rango se aplica aquí y no en el SQL de arriba: `consulted_at` está en
    // la consulta, no en el componente, y así pasa por el mismo camino que el
    // resto de lecturas (filtro de archivados y propiedad incluidos).
    const porFecha: Record<string, any> = {};
    if (rango.desde) porFecha.$gte = rango.desde;
    if (rango.hasta) porFecha.$lte = rango.hasta;

    return strapi.documents('api::clinical.consultation').findMany({
      filters: {
        documentId: { $in: documentIds },
        ...(Object.keys(porFecha).length > 0 ? { consultedAt: porFecha } : {}),
      } as any,
      populate: { pet: true, sections: { on: { [componente]: true } } } as any,
      sort: 'consultedAt:desc' as any,
    });
  },
}));
