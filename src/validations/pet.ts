import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  assertNoDuplicate,
  effective,
  effectiveRelation,
  loadCurrent,
  on,
  today,
} from './helpers';

export default (strapi: Core.Strapi): void => {
  // ---- api::pet.breed ------------------------------------------------------

  on(strapi, 'api::pet.breed', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['species']);

    const species = effectiveRelation(data, current, 'species');
    const name = effective<string>(data, current, 'name');

    if (species && name) {
      await assertNoDuplicate(
        strapi,
        'api::pet.breed',
        { species: { documentId: species }, name },
        ctx.params.documentId,
        `La raza "${name}" ya existe para esa especie`
      );
    }

    return next();
  });

  // ---- api::pet.pet --------------------------------------------------------

  on(strapi, 'api::pet.pet', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['species', 'breed']);

    const speciesId = effectiveRelation(data, current, 'species');
    const breedId = effectiveRelation(data, current, 'breed');
    const birthDate = effective<string>(data, current, 'birthDate');
    const sterilizationState = effective<string>(data, current, 'sterilizationState');
    const sterilizedOn = effective<string>(data, current, 'sterilizedOn');

    // La raza debe pertenecer a la especie de la mascota.
    if (breedId && speciesId) {
      const breed = await strapi.documents('api::pet.breed').findOne({
        documentId: breedId,
        populate: ['species'] as any,
      });
      const breedSpecies = (breed as any)?.species?.documentId;
      if (breedSpecies && breedSpecies !== speciesId) {
        throw new ValidationError('La raza seleccionada no pertenece a la especie de la mascota');
      }
    }

    if (birthDate && birthDate > today()) {
      throw new ValidationError('La fecha de nacimiento no puede ser futura');
    }

    if (sterilizedOn && sterilizationState !== 'sterilized') {
      throw new ValidationError(
        'Solo se puede indicar la fecha de esterilización si el estado es "sterilized"'
      );
    }

    return next();
  });
};
