import type { Core } from '@strapi/strapi';
import { LABEL_BUILDERS, refrescarEtiqueta } from '../labels';
import { includeArchived } from './archived';

/**
 * Mantiene al día los `searchLabel` (ver src/labels.ts).
 *
 * Después de cada escritura recalcula la etiqueta del documento. Y cuando
 * cambia un dato del que dependen otras etiquetas, propaga en cascada: si
 * Carlos se cambia el apellido, se rehacen las etiquetas de su ficha de
 * cliente, sus contactos, sus mascotas y las consultas de esas mascotas, para
 * que ningún selector muestre un nombre que ya no existe.
 */

/** Campos cuyo cambio obliga a rehacer las etiquetas que dependen de ellos. */
const DISPARADORES: Record<string, string[]> = {
  'api::identity.profile': ['firstName', 'lastName', 'documentType', 'documentNumber'],
  'api::pet.pet': ['name', 'owner', 'breed', 'species'],
  'api::pet.species': ['name'],
  'api::pet.breed': ['name', 'species'],
};

/** Una escritura que solo trae `searchLabel` es la nuestra: no se reprocesa. */
const esEscrituraDeEtiqueta = (data: any): boolean =>
  !!data && Object.keys(data).length === 1 && 'searchLabel' in data;

const cambioAlguno = (data: any, campos: string[]): boolean =>
  campos.some((c) => c in (data ?? {}));

/** Perfil -> cliente -> mascotas -> consultas, más los contactos del perfil. */
async function cascadaDesdePerfil(strapi: Core.Strapi, profileDocumentId: string): Promise<number> {
  let n = 0;

  const perfil = await strapi.documents('api::identity.profile').findOne({
    documentId: profileDocumentId,
    populate: ['customer', 'contacts'] as any,
    filters: includeArchived('api::identity.profile') as any,
  } as any);

  if (!perfil) return 0;

  for (const contacto of (perfil as any).contacts ?? []) {
    if (await refrescarEtiqueta(strapi, 'api::shared.contact', contacto.documentId)) n++;
  }

  const customerId = (perfil as any).customer?.documentId;
  if (!customerId) return n;

  if (await refrescarEtiqueta(strapi, 'api::customer.customer', customerId)) n++;

  const mascotas = await strapi.documents('api::pet.pet').findMany({
    filters: { owner: { documentId: customerId }, ...includeArchived('api::pet.pet') } as any,
  });

  for (const mascota of mascotas) {
    if (await refrescarEtiqueta(strapi, 'api::pet.pet', mascota.documentId)) n++;

    const consultas = await strapi.documents('api::clinical.consultation').findMany({
      filters: { pet: { documentId: mascota.documentId }, ...includeArchived('api::clinical.consultation') } as any,
    });
    for (const consulta of consultas) {
      if (await refrescarEtiqueta(strapi, 'api::clinical.consultation', consulta.documentId)) n++;
    }
  }

  return n;
}

/** Al renombrar una especie o una raza cambian las etiquetas de sus mascotas. */
async function cascadaCatalogo(
  strapi: Core.Strapi,
  uid: string,
  documentId: string
): Promise<number> {
  let n = 0;

  if (uid === 'api::pet.species') {
    const razas = await strapi.documents('api::pet.breed').findMany({
      filters: { species: { documentId } } as any,
    });
    for (const raza of razas) {
      if (await refrescarEtiqueta(strapi, 'api::pet.breed', raza.documentId)) n++;
      n += await cascadaCatalogo(strapi, 'api::pet.breed', raza.documentId);
    }
    return n;
  }

  const mascotas = await strapi.documents('api::pet.pet').findMany({
    filters: { breed: { documentId }, ...includeArchived('api::pet.pet') } as any,
  });
  for (const mascota of mascotas) {
    if (await refrescarEtiqueta(strapi, 'api::pet.pet', mascota.documentId)) n++;
  }

  return n;
}

async function cascadaDesdeMascota(strapi: Core.Strapi, petDocumentId: string): Promise<number> {
  let n = 0;
  const consultas = await strapi.documents('api::clinical.consultation').findMany({
    filters: { pet: { documentId: petDocumentId }, ...includeArchived('api::clinical.consultation') } as any,
  });
  for (const consulta of consultas) {
    if (await refrescarEtiqueta(strapi, 'api::clinical.consultation', consulta.documentId)) n++;
  }
  return n;
}

export default (strapi: Core.Strapi): void => {
  const UIDS = new Set([...Object.keys(LABEL_BUILDERS), ...Object.keys(DISPARADORES)]);

  strapi.documents.use(async (ctx: any, next: any) => {
    if (!UIDS.has(ctx.uid) || !['create', 'update'].includes(ctx.action)) return next();

    const data = ctx.params?.data ?? {};
    if (esEscrituraDeEtiqueta(data)) return next();

    const resultado = await next();
    const documentId = resultado?.documentId ?? ctx.params?.documentId;
    if (!documentId) return resultado;

    if (LABEL_BUILDERS[ctx.uid]) {
      await refrescarEtiqueta(strapi, ctx.uid, documentId);
    }

    const disparadores = DISPARADORES[ctx.uid];
    if (disparadores && (ctx.action === 'create' || cambioAlguno(data, disparadores))) {
      let tocados = 0;
      if (ctx.uid === 'api::identity.profile') {
        tocados = await cascadaDesdePerfil(strapi, documentId);
      } else if (ctx.uid === 'api::pet.pet') {
        tocados = await cascadaDesdeMascota(strapi, documentId);
      } else {
        tocados = await cascadaCatalogo(strapi, ctx.uid, documentId);
      }
      if (tocados > 0) {
        strapi.log.debug(`[labels] ${tocados} etiquetas recalculadas en cascada desde ${ctx.uid}`);
      }
    }

    return resultado;
  });
};
