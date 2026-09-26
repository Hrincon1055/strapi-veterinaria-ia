import type { Core } from '@strapi/strapi';

/**
 * Seed idempotente de los catálogos mínimos para que la aplicación arranque
 * con algo usable. Se busca por la clave natural antes de crear, así que
 * ejecutarlo muchas veces no duplica nada ni pisa ediciones posteriores.
 */

/** ISO 3166-1 alfa-2, con el indicativo telefónico. Colombia primero. */
const COUNTRIES = [
  { isoCode: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴' },
  { isoCode: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷' },
  { isoCode: 'BR', name: 'Brasil', dialCode: '+55', flag: '🇧🇷' },
  { isoCode: 'CA', name: 'Canadá', dialCode: '+1', flag: '🇨🇦' },
  { isoCode: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱' },
  { isoCode: 'CR', name: 'Costa Rica', dialCode: '+506', flag: '🇨🇷' },
  { isoCode: 'EC', name: 'Ecuador', dialCode: '+593', flag: '🇪🇨' },
  { isoCode: 'ES', name: 'España', dialCode: '+34', flag: '🇪🇸' },
  { isoCode: 'FR', name: 'Francia', dialCode: '+33', flag: '🇫🇷' },
  { isoCode: 'IT', name: 'Italia', dialCode: '+39', flag: '🇮🇹' },
  { isoCode: 'MX', name: 'México', dialCode: '+52', flag: '🇲🇽' },
  { isoCode: 'PA', name: 'Panamá', dialCode: '+507', flag: '🇵🇦' },
  { isoCode: 'PE', name: 'Perú', dialCode: '+51', flag: '🇵🇪' },
  { isoCode: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
  { isoCode: 'US', name: 'Estados Unidos', dialCode: '+1', flag: '🇺🇸' },
  { isoCode: 'UY', name: 'Uruguay', dialCode: '+598', flag: '🇺🇾' },
  { isoCode: 'VE', name: 'Venezuela', dialCode: '+58', flag: '🇻🇪' },
];

const SPECIES = ['Perro', 'Gato'];

const SERVICE_CATEGORIES = [
  { name: 'Consulta', sortOrder: 10 },
  { name: 'Vacunación', sortOrder: 20 },
  { name: 'Cirugía', sortOrder: 30 },
  { name: 'Estética', sortOrder: 40 },
  { name: 'Laboratorio', sortOrder: 50 },
  { name: 'Imagenología', sortOrder: 60 },
];

/** Crea el documento solo si no existe otro con la misma clave natural. */
async function ensure(
  strapi: Core.Strapi,
  uid: string,
  key: Record<string, any>,
  data: Record<string, any>
): Promise<boolean> {
  const found = await strapi.documents(uid as any).findFirst({ filters: key as any });
  if (found) return false;
  await strapi.documents(uid as any).create({ data: data as any });
  return true;
}

export default async (strapi: Core.Strapi): Promise<void> => {
  let created = 0;

  for (const country of COUNTRIES) {
    if (await ensure(strapi, 'api::shared.country', { isoCode: country.isoCode }, country)) created++;
  }

  for (const name of SPECIES) {
    if (await ensure(strapi, 'api::pet.species', { name }, { name, isActive: true })) created++;
  }

  for (const category of SERVICE_CATEGORIES) {
    if (
      await ensure(
        strapi,
        'api::scheduling.service-category',
        { name: category.name },
        { ...category, isActive: true }
      )
    ) {
      created++;
    }
  }

  if (created > 0) {
    strapi.log.info(`[seed] ${created} registros de catálogo creados`);
  }
};
