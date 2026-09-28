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
 * Estados de una línea de la consulta. `dispensed` (entregado para llevar)
 * solo tiene sentido con un producto: un servicio se aplica o se recomienda.
 */
const SOLO_PRODUCTO = ['dispensed'];

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
      items: { populate: ['service', 'product'] },
    });

    // Si no se indica el momento de la consulta, es ahora.
    if (ctx.action === 'create' && !data.consultedAt) {
      data.consultedAt = new Date().toISOString();
      ctx.params.data = data;
    }

    // Servicios y productos de la consulta: qué aplicó, entregó o recomendó el
    // veterinario, y cuánto. Cada línea apunta a UNA cosa del catálogo —un
    // servicio o un producto—, que es lo que la facturación convertirá en
    // cargo con el precio y el impuesto de ese catálogo. Un componente no
    // atraviesa el Document Service por su cuenta, solo como parte de su
    // padre, así que la regla vive aquí.
    if (Array.isArray(data.items)) {
      const guardadas = porId(current?.items);

      for (const linea of data.items) {
        const previa = previaDe(guardadas, linea);
        const servicio = relacionDeComponente(linea?.service, previa, 'service');
        const producto = relacionDeComponente(linea?.product, previa, 'product');

        if (!servicio && !producto) {
          throw new ValidationError('Cada línea de la consulta debe indicar un servicio o un producto');
        }
        if (servicio && producto) {
          throw new ValidationError(
            'Cada línea de la consulta lleva un servicio o un producto, no los dos: usa una línea para cada uno'
          );
        }
        const estado = linea?.state ?? previa?.state;
        if (servicio && SOLO_PRODUCTO.includes(estado)) {
          throw new ValidationError(
            'Un servicio se aplica o se recomienda; "entregado" (dispensed) es solo para productos'
          );
        }
      }
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
