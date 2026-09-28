import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  assertNoDuplicate,
  effective,
  effectiveRelation,
  isAfter,
  loadCurrent,
  on,
  porId,
  previaDe,
  relacionDeComponente,
  today,
} from './helpers';

/**
 * Tarjetas de la zona `lines` (Servicios y productos): qué relación lleva cada
 * una y de dónde sale su nombre. Añadir un tipo de línea = una entrada aquí,
 * otra en `populate-sections` y otra en `populate-history`.
 *
 * Lo que antes eran reglas —"servicio o producto, no los dos", "entregado solo
 * para productos"— ahora lo impone el propio componente: cada tarjeta tiene un
 * único selector y su propia lista de estados.
 */
const LINEAS: Record<string, { campo: string; uid: string; nombre: string; etiqueta: string }> = {
  'clinical.service-line': { campo: 'service', uid: 'api::scheduling.service', nombre: 'servicio', etiqueta: 'name' },
  'clinical.product-line': { campo: 'product', uid: 'api::catalog.product', nombre: 'producto', etiqueta: 'searchLabel' },
};

const POPULATE_LINEAS = {
  on: {
    'clinical.service-line': { populate: ['service'] },
    'clinical.product-line': { populate: ['product'] },
  },
};

export default (strapi: Core.Strapi): void => {
  // ---- api::clinical.vaccine ----------------------------------------------

  on(strapi, 'api::clinical.vaccine', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['species']);

    const species = effectiveRelation(data, current, 'species');
    const name = effective<string>(data, current, 'name');

    if (species && name) {
      await assertNoDuplicate(
        strapi,
        'api::clinical.vaccine',
        { species: { documentId: species }, name },
        ctx.params.documentId,
        `La vacuna "${name}" ya existe para esa especie`
      );
    }

    return next();
  });

  // ---- api::clinical.consultation -----------------------------------------

  on(strapi, 'api::clinical.consultation', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, {
      pet: true,
      lines: POPULATE_LINEAS,
    });

    // Si no se indica el momento de la consulta, es ahora.
    if (ctx.action === 'create' && !data.consultedAt) {
      data.consultedAt = new Date().toISOString();
      ctx.params.data = data;
    }

    // Servicios y productos de la consulta (zona `lines`): qué aplicó, entregó
    // o recomendó el veterinario, y cuánto. La facturación convertirá en cargo
    // cada línea con el precio y el impuesto del catálogo. Un componente no
    // atraviesa el Document Service por su cuenta, solo como parte de su
    // padre, así que la regla vive aquí.
    if (Array.isArray(data.lines)) {
      const guardadas = porId(current?.lines);

      for (const linea of data.lines) {
        const tipo = LINEAS[linea?.__component];
        if (!tipo) continue; // Strapi rechaza por su cuenta un componente ajeno a la zona.

        const previa = previaDe(guardadas, linea);
        const documentId = relacionDeComponente(linea[tipo.campo], previa, tipo.campo);
        if (!documentId) {
          throw new ValidationError(`Cada línea de ${tipo.nombre} de la consulta debe indicar qué ${tipo.nombre} es`);
        }

        // El panel pinta en la cabecera de un bloque cerrado el valor de un
        // campo de texto del componente; una relación no sirve para eso. Sin
        // `label`, todas las cabeceras dirían solo "Producto" o "Servicio".
        // Lo pone siempre el servidor: se ignora lo que llegue.
        const destino: any = await strapi.documents(tipo.uid as any).findOne({
          documentId,
          fields: ['name', tipo.etiqueta] as any,
        });
        if (!destino) {
          throw new ValidationError(`El ${tipo.nombre} indicado no existe`);
        }
        linea.label = String(destino[tipo.etiqueta] ?? destino.name ?? '').slice(0, 255) || null;
      }
      ctx.params.data = data;
    }

    const consultedAt = effective<string>(data, current, 'consultedAt');
    const nextControlOn = effective<string>(data, current, 'nextControlOn');

    if (nextControlOn && consultedAt && !isAfter(nextControlOn, consultedAt)) {
      throw new ValidationError(
        'La fecha del próximo control debe ser posterior a la fecha de la consulta'
      );
    }

    const result = await next();

    // El peso tomado en consulta pasa a ser el peso actual de la mascota.
    if (data.weightKg !== undefined && data.weightKg !== null) {
      const petId = effectiveRelation(data, current, 'pet') ?? (result as any)?.pet?.documentId;
      if (petId) {
        await strapi.documents('api::pet.pet').update({
          documentId: petId,
          data: { weightKg: data.weightKg } as any,
        });
      }
    }

    return result;
  });

  // ---- api::clinical.pet-vaccination --------------------------------------

  on(strapi, 'api::clinical.pet-vaccination', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['pet', 'vaccine']);

    const petId = effectiveRelation(data, current, 'pet');
    const vaccineId = effectiveRelation(data, current, 'vaccine');
    const appliedOn = effective<string>(data, current, 'appliedOn');
    const nextDueOn = effective<string>(data, current, 'nextDueOn');

    // La vacuna debe ser de la misma especie que la mascota.
    if (petId && vaccineId) {
      const [pet, vaccine] = await Promise.all([
        strapi.documents('api::pet.pet').findOne({ documentId: petId, populate: ['species'] as any }),
        strapi.documents('api::clinical.vaccine').findOne({
          documentId: vaccineId,
          populate: ['species'] as any,
        }),
      ]);
      const petSpecies = (pet as any)?.species?.documentId;
      const vaccineSpecies = (vaccine as any)?.species?.documentId;
      if (petSpecies && vaccineSpecies && petSpecies !== vaccineSpecies) {
        throw new ValidationError('Esa vacuna no corresponde a la especie de la mascota');
      }
    }

    if (appliedOn && appliedOn > today()) {
      throw new ValidationError('La fecha de aplicación no puede ser futura');
    }

    if (nextDueOn && appliedOn && !isAfter(nextDueOn, appliedOn)) {
      throw new ValidationError(
        'La fecha del próximo refuerzo debe ser posterior a la de aplicación'
      );
    }

    return next();
  });

  // ---- api::clinical.allergy ----------------------------------------------

  on(strapi, 'api::clinical.allergy', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx);

    const isActive = effective<boolean>(data, current, 'isActive');
    const resolvedOn = effective<string>(data, current, 'resolvedOn');

    if (isActive === false && !resolvedOn) {
      throw new ValidationError(
        'Una alergia inactiva necesita la fecha en que se resolvió (resolvedOn)'
      );
    }

    return next();
  });
};
