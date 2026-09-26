import type { Core } from '@strapi/strapi';
import { ValidationError, effective, loadCurrent, on, toDocumentId } from './helpers';

export default (strapi: Core.Strapi): void => {
  on(strapi, 'api::travel.travel-case', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    if (!('requirements' in data)) return next();

    const current = await loadCurrent(strapi, ctx, ['requirements']);
    const previous: any[] = current?.requirements ?? [];
    const requirements = data.requirements;

    if (!Array.isArray(requirements)) return next();

    for (const req of requirements) {
      if (req?.isCompleted !== true) continue;

      if (!toDocumentId(req.verifiedBy)) {
        throw new ValidationError(
          `El requisito "${req.requirementName ?? ''}" no puede marcarse como cumplido sin quién lo verificó`
        );
      }

      // Se sella el momento de verificación cuando el requisito pasa a cumplido.
      const before = previous.find((p) => p.id === req.id);
      if (!req.verifiedAt && (!before || before.isCompleted !== true)) {
        req.verifiedAt = new Date().toISOString();
      }
    }

    ctx.params.data = data;
    return next();
  });
};
