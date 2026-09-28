import type { Core } from '@strapi/strapi';

/**
 * Roles y permisos de la API (users-permissions): solo Cliente y Public.
 *
 * El staff (Recepción, Veterinario, Administrador de clínica) trabaja en el
 * panel con cuentas `admin::user`; sus roles están en `admin-roles.ts`. Se
 * sacaron de aquí con `migrate-staff-to-admin.js`, así que este bootstrap ya
 * no los crea: si volvieran a aparecer, recrearía roles de API sin usuarios.
 *
 * Es idempotente: crea el rol si falta y añade solo los permisos que no
 * existan, sin tocar los que un administrador haya ajustado a mano.
 */

const READ = ['find', 'findOne'];

/** Catálogos: lectura pública y mantenimiento reservado a la administración. */
const CATALOGS = [
  'api::shared.country',
  'api::pet.species',
  'api::pet.breed',
  'api::scheduling.service-category',
  'api::scheduling.service',
  'api::billing.plan',
  'api::billing.plan-benefit',
];

/** Acciones `uid.accion` a partir de una lista de UIDs. */
const actions = (uids: string[], verbs: string[]): string[] =>
  uids.flatMap((uid) => verbs.map((verb) => `${uid}.${verb}`));

const CLIENT_READ = [
  'api::pet.pet',
  'api::scheduling.appointment',
  'api::clinical.consultation',
  'api::clinical.pet-vaccination',
  'api::clinical.allergy',
  'api::billing.subscription',
  'api::billing.invoice',
  'api::documents.signed-document',
  'api::notification.notification-recipient',
];

type RoleSpec = { name: string; description: string; type: string; actions: string[] };

const ROLES: RoleSpec[] = [
  {
    name: 'Cliente',
    type: 'client',
    description: 'Dueño de mascotas. Solo ve sus propios datos (policy global::is-owner).',
    actions: [
      ...actions(CLIENT_READ, READ),
      'api::scheduling.appointment.create',
      // El cliente busca en su propia historia: la policy is-owner la acota.
      'api::clinical.consultation.searchBySection',
      ...actions(['api::identity.profile', 'api::shared.contact', 'api::notification.notification-recipient'], ['update']),
      // El catálogo de vacunas: sin él, populate[vaccine] del carné se
      // descarta en el saneado y el cliente ve dosis sin nombre.
      ...actions(['api::clinical.vaccine'], READ),
      // DECISIÓN: el cliente también lee los catálogos. La tabla del modelo
      // solo se los da a Public, pero en Strapi un usuario autenticado no
      // hereda los permisos de Public, y sin esto no podría elegir servicio al
      // agendar una cita en línea.
      ...actions(CATALOGS, READ),
      'api::clinic.clinic.find',
      // El cliente necesita los huecos libres para reservar en línea.
      'api::scheduling.availability.find',
    ],
  },
];

const PUBLIC_ACTIONS = [
  ...actions(CATALOGS, READ),
  'plugin::users-permissions.auth.register',
  'plugin::users-permissions.auth.callback',
  // Alta en el portal: por aquí entra quien todavía no tiene cuenta.
  // `register` crea la ficha nueva; `claim` vincula una ficha de mostrador ya
  // existente tras verificar un contacto (ver src/api/identity/services/portal.ts).
  'api::identity.portal.register',
  'api::identity.portal.claimStart',
  'api::identity.portal.claimComplete',
];

/** Añade los permisos que falten a un rol, sin tocar los existentes. */
async function grant(strapi: Core.Strapi, roleId: number, wanted: string[]): Promise<number> {
  const unique = [...new Set(wanted)];

  const existing = await strapi.query('plugin::users-permissions.permission').findMany({
    where: { role: roleId },
  });
  const have = new Set(existing.map((p: any) => p.action));

  const missing = unique.filter((action) => !have.has(action));

  for (const action of missing) {
    await strapi.query('plugin::users-permissions.permission').create({
      data: { action, role: roleId },
    });
  }

  return missing.length;
}

export default async (strapi: Core.Strapi): Promise<void> => {
  const roleQuery = strapi.query('plugin::users-permissions.role');

  // Rol público: catálogos y alta de usuario.
  const publicRole = await roleQuery.findOne({ where: { type: 'public' } });
  if (publicRole) {
    const added = await grant(strapi, publicRole.id, PUBLIC_ACTIONS);
    if (added) strapi.log.info(`[roles] Public: ${added} permisos añadidos`);
  }

  for (const spec of ROLES) {
    let role = await roleQuery.findOne({ where: { type: spec.type } });

    if (!role) {
      role = await roleQuery.create({
        data: { name: spec.name, description: spec.description, type: spec.type },
      });
      strapi.log.info(`[roles] creado el rol "${spec.name}" (${spec.type})`);
    }

    const added = await grant(strapi, role.id, spec.actions);
    if (added) strapi.log.info(`[roles] ${spec.name}: ${added} permisos añadidos`);
  }

  // Quien se registra por la API es un cliente.
  const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
  const advanced: any = (await pluginStore.get({ key: 'advanced' })) ?? {};
  if (advanced.default_role !== 'client') {
    await pluginStore.set({ key: 'advanced', value: { ...advanced, default_role: 'client' } });
    strapi.log.info('[roles] el rol por defecto al registrarse es ahora "client"');
  }
};
