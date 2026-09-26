import type { Core } from '@strapi/strapi';
import { OWNERSHIP_RULES, type Ownership } from '../ownership';

/**
 * Restringe una ruta a los datos del cliente autenticado.
 *
 * La cadena de propiedad está en `src/ownership.ts`; aquí solo se aplica.
 *
 * Actúa únicamente sobre usuarios con rol `client`: el staff (recepción,
 * veterinario, administración) la atraviesa sin filtro, porque su alcance ya lo
 * decide el permiso del rol.
 *
 * - En las rutas con `:id` comprueba aquí mismo la pertenencia del documento,
 *   porque el Document Service resuelve `findOne` por documentId y ahí un
 *   filtro no serviría.
 * - En los listados solo deja la propiedad resuelta en `ctx.state.ownership`;
 *   quien filtra es el middleware `src/validations/ownership.ts`. El filtro no
 *   se puede inyectar en `request.query` desde aquí: pasaría por la validación
 *   de parámetros de entrada y `strictParams` lo rechazaría, porque el rol
 *   Cliente no puede atravesar la relación `owner` hacia `customer`.
 */

const CLIENT_ROLE = 'client';

/** Centinela para que un cliente sin mascotas no vea nada en vez de verlo todo. */
const SIN_MASCOTAS = '__cliente-sin-mascotas__';

export default async (policyContext: any, _config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  // El staff no se filtra por propiedad.
  if (user.role?.type !== CLIENT_ROLE) return true;

  // El UID sale del handler de la ruta: "api::dominio.tipo.accion".
  const handler: string = policyContext.state?.route?.handler ?? '';
  const uid = handler.split('.').slice(0, 2).join('.');
  const rule = OWNERSHIP_RULES[uid];
  if (!rule) return false;

  const profile = await strapi.documents('api::identity.profile').findFirst({
    filters: { user: { documentId: user.documentId } } as any,
    populate: ['customer'] as any,
  });

  const profileId = (profile as any)?.documentId;
  const customerId = (profile as any)?.customer?.documentId;
  if (!profileId || !customerId) return false;

  const pets = await strapi.documents('api::pet.pet').findMany({
    filters: { owner: { documentId: customerId } } as any,
  });

  const petIds = pets.length > 0 ? pets.map((p: any) => p.documentId) : [SIN_MASCOTAS];

  const ownership: Ownership = { profileId, customerId, petIds };

  // Ruta con :id -> se comprueba ese documento concreto, antes de publicar la
  // propiedad en el estado (así esta lectura no se filtra a sí misma).
  const documentId = policyContext.params?.id;
  if (documentId) {
    const entity = await strapi.documents(uid as any).findOne({
      documentId,
      populate: rule.populate,
    });
    if (!entity || !rule.owns(entity, ownership)) return false;
  }

  policyContext.state.ownership = ownership;
  return true;
};
