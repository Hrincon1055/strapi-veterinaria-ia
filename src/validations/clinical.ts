import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  assertNoDuplicate,
  effective,
  effectiveRelation,
  isAfter,
  loadCurrent,
  on,
  toDocumentId,
  today,
} from './helpers';

/**
 * Servicio de una línea de consulta, como documentId.
 *
 * El panel manda las relaciones como diferencia (`{ connect, disconnect }`):
 * en una línea que ya existía y cuyo servicio no se tocó llegan las dos listas
 * vacías, y `toDocumentId` lo leería como "se está limpiando". En ese caso, y
 * cuando la relación ni siquiera viene, vale la de la línea guardada.
 */
function servicioDeLinea(valor: any, previa: any): string | null | undefined {
  const guardado = previa?.service?.documentId ?? null;
  if (valor === undefined) return guardado;
  if (
    valor &&
    typeof valor === 'object' &&
    !Array.isArray(valor) &&
    Array.isArray(valor.connect) &&
    valor.connect.length === 0 &&
    (!Array.isArray(valor.disconnect) || valor.disconnect.length === 0) &&
    valor.set === undefined
  ) {
    return guardado;
  }
  return toDocumentId(valor);
}

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
      services: { populate: ['service'] },
    });

    // Si no se indica el momento de la consulta, es ahora.
    if (ctx.action === 'create' && !data.consultedAt) {
      data.consultedAt = new Date().toISOString();
      ctx.params.data = data;
    }

    // Líneas de servicio: qué procedimientos hizo el veterinario y cuántas
    // veces. Sin precio ni duración — eso es de la facturación, que los sacará
    // del catálogo. Un componente no atraviesa el Document Service por su
    // cuenta, solo como parte de su padre, así que la regla vive aquí.
    if (Array.isArray(data.services)) {
      const guardadas = new Map<number, any>(
        (current?.services ?? []).map((l: any) => [Number(l.id), l])
      );

      for (const linea of data.services) {
        const previa = linea?.id != null ? guardadas.get(Number(linea.id)) : undefined;
        if (!servicioDeLinea(linea?.service, previa)) {
          throw new ValidationError('Cada línea de servicio debe indicar un servicio');
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
