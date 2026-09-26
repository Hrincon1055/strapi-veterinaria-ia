import type { Core } from '@strapi/strapi';

/**
 * Roles y permisos de la sección 10 del modelo, con el RBAC nativo de
 * `users-permissions`. No hay tablas propias de roles ni permisos.
 *
 * Es idempotente: crea el rol si falta y añade solo los permisos que no
 * existan, sin tocar los que un administrador haya ajustado a mano.
 */

const CRUD = ['find', 'findOne', 'create', 'update', 'delete'];
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

/** Catálogos que además administra la clínica (incluye consultorios y vacunas). */
const MANAGED_CATALOGS = [
  ...CATALOGS,
  'api::scheduling.clinic-room',
  'api::clinical.vaccine',
];

const RECEPTION_CRUD = [
  'api::identity.profile',
  'api::shared.contact',
  'api::customer.customer',
  'api::customer.customer-note',
  'api::pet.pet',
  'api::scheduling.appointment',
  'api::billing.subscription',
  'api::billing.invoice',
  'api::travel.travel-case',
];

const VET_CRUD = [
  'api::clinical.consultation',
  'api::scheduling.consultation-service',
  'api::clinical.pet-vaccination',
  'api::clinical.allergy',
  'api::documents.signed-document',
  'api::documents.signed-document-signer',
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

const receptionActions = [
  ...actions(RECEPTION_CRUD, CRUD),
  ...actions(MANAGED_CATALOGS, READ),
  ...actions(['api::clinical.consultation'], READ),
];

const vetActions = [...receptionActions, ...actions(VET_CRUD, CRUD), 'api::documents.signed-document-event.create'];

const clinicAdminActions = [
  ...vetActions,
  ...actions(MANAGED_CATALOGS, CRUD),
  ...actions(['api::marketing.campaign', 'api::marketing.campaign-metric', 'api::notification.notification'], CRUD),
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
      ...actions(['api::identity.profile', 'api::shared.contact', 'api::notification.notification-recipient'], ['update']),
      // DECISIÓN: el cliente también lee los catálogos. La tabla del modelo
      // solo se los da a Public, pero en Strapi un usuario autenticado no
      // hereda los permisos de Public, y sin esto no podría elegir servicio al
      // agendar una cita en línea.
      ...actions(CATALOGS, READ),
    ],
  },
  {
    name: 'Recepción',
    type: 'receptionist',
    description: 'Front desk: agenda, clientes, mascotas, facturación y viajes.',
    actions: receptionActions,
  },
  {
    name: 'Veterinario',
    type: 'veterinarian',
    description: 'Todo lo de recepción más la historia clínica y los documentos firmados.',
    actions: vetActions,
  },
  {
    name: 'Administrador de clínica',
    type: 'clinic_admin',
    description: 'Todo lo anterior más catálogos, campañas y notificaciones.',
    actions: clinicAdminActions,
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
