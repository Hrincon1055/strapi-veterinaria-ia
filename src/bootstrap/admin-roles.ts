import type { Core } from '@strapi/strapi';

/**
 * Roles del PANEL para el staff: Recepción, Veterinario y Administrador de
 * clínica. El staff trabaja en el panel con cuentas `admin::user`; el rol
 * Cliente sigue en users-permissions (ver `roles.ts`).
 *
 * Reparten lo mismo que repartían los roles de users-permissions que
 * sustituyen, traducido al RBAC del panel: `explorer.read/create/update/delete`
 * del Content Manager sobre cada content type, con todos sus campos.
 *
 * Es idempotente y solo AÑADE: crea el rol si falta y concede los permisos
 * que no tenga, con `addPermissions`. No se usa `assignPermissions`, que
 * REEMPLAZA la lista completa del rol y rompía el arranque cuando esa lista
 * incluía una acción que ya no existía (ver server/bootstrap.js del plugin de
 * agenda). Lo que se quite desde Ajustes → Roles vuelve en el siguiente
 * arranque, igual que en `roles.ts`.
 */

const READ = ['read'];
const CRUD = ['read', 'create', 'update', 'delete'];

/** Catálogos: todo el staff los consulta; solo la administración los mantiene. */
const CATALOGOS = [
  'api::shared.country',
  'api::pet.species',
  'api::pet.breed',
  'api::scheduling.service-category',
  'api::scheduling.service',
  'api::billing.plan',
  'api::billing.plan-benefit',
  'api::scheduling.clinic-room',
  'api::clinical.vaccine',
  'api::catalog.product-category',
  'api::catalog.product',
];

const RECEPCION_CRUD = [
  'api::identity.profile',
  'api::shared.contact',
  'api::customer.customer',
  'api::customer.customer-note',
  'api::pet.pet',
  'api::scheduling.appointment',
  'api::billing.subscription',
  'api::billing.invoice',
  'api::billing.invoice-item',
  'api::travel.travel-case',
  'api::scheduling.staff-schedule',
  'api::scheduling.schedule-exception',
];

const VETERINARIO_CRUD = [
  'api::clinical.consultation',
  'api::clinical.pet-vaccination',
  'api::clinical.allergy',
  'api::documents.signed-document',
  'api::documents.signed-document-signer',
];

type Concesion = { subjects: string[]; verbos: string[] };

/**
 * Permisos que no son del Content Manager.
 *
 * `admin::users.read` es imprescindible aunque no lo parezca: Strapi lo
 * declara como alias de "leer `admin::user`" en el Content Manager, y sin él
 * el selector de `vet`, `responsible`, `staff`… muestra el documentId en vez
 * del correo (content-manager `relations.js`, `sanitizeMainField`). El precio
 * es que el staff ve la lista de cuentas del panel en Ajustes, solo lectura.
 *
 * La biblioteca de medios: adjuntos clínicos, fotos de mascotas, documentos
 * de viaje. Sin `upload.read` el campo de media no deja elegir archivo.
 */
const COMUNES_PANEL = [
  'admin::users.read',
  'plugin::upload.read',
  'plugin::upload.assets.create',
  'plugin::upload.assets.update',
  'plugin::upload.assets.download',
  'plugin::upload.assets.copy-link',
];

const AGENDA = {
  propia: 'plugin::veterinaria-agenda.agenda.ver-propia',
  todas: 'plugin::veterinaria-agenda.agenda.ver-todas',
  agendar: 'plugin::veterinaria-agenda.agenda.agendar',
};

/**
 * Facturación (plugin `veterinaria-facturacion`). Recepción prepara, emite y
 * cobra; el veterinario solo consulta qué se cobró; anular una factura
 * emitida y cambiar un precio de catálogo son de la administración (el Super
 * Admin recibe todas las acciones registradas al arrancar).
 */
const FACTURACION = {
  ver: 'plugin::veterinaria-facturacion.facturacion.ver',
  preparar: 'plugin::veterinaria-facturacion.facturacion.preparar',
  emitir: 'plugin::veterinaria-facturacion.facturacion.emitir',
  anular: 'plugin::veterinaria-facturacion.facturacion.anular',
  cambiarPrecio: 'plugin::veterinaria-facturacion.facturacion.cambiar-precio',
};

const recepcion: Concesion[] = [
  { subjects: RECEPCION_CRUD, verbos: CRUD },
  { subjects: [...CATALOGOS, 'api::clinical.consultation', 'api::clinic.clinic'], verbos: READ },
  // Recepción asocia la cuenta de la app al perfil del cliente.
  { subjects: ['plugin::users-permissions.user'], verbos: READ },
];

const veterinario: Concesion[] = [
  ...recepcion,
  { subjects: VETERINARIO_CRUD, verbos: CRUD },
  { subjects: ['api::documents.signed-document-event'], verbos: ['read', 'create'] },
];

const administracion: Concesion[] = [
  ...veterinario,
  { subjects: CATALOGOS, verbos: CRUD },
  {
    subjects: ['api::marketing.campaign', 'api::marketing.campaign-metric', 'api::notification.notification'],
    verbos: CRUD,
  },
  // La configuración fiscal la cambia solo la administración de la clínica.
  { subjects: ['api::clinic.clinic'], verbos: ['update'] },
  // Proveedores: costos y condiciones de compra, no son cosa del mostrador.
  { subjects: ['api::catalog.supplier'], verbos: CRUD },
];

type RolPanel = { name: string; description: string; concesiones: Concesion[]; otras: string[] };

export const ROLES_PANEL: RolPanel[] = [
  {
    name: 'Recepción',
    description: 'Front desk: agenda, clientes, mascotas, facturación y viajes.',
    concesiones: recepcion,
    // Recepción mira la agenda de todos y es quien reserva en los huecos.
    otras: [...COMUNES_PANEL, AGENDA.todas, AGENDA.agendar, FACTURACION.ver, FACTURACION.preparar, FACTURACION.emitir],
  },
  {
    name: 'Veterinario',
    description: 'Todo lo de recepción más la historia clínica y los documentos firmados.',
    concesiones: veterinario,
    // El veterinario atiende lo que ya tiene agendado: ve su agenda, no reserva.
    otras: [...COMUNES_PANEL, AGENDA.propia, FACTURACION.ver],
  },
  {
    name: 'Administrador de clínica',
    description: 'Todo lo anterior más catálogos, campañas, notificaciones y datos de la clínica.',
    concesiones: administracion,
    otras: [...COMUNES_PANEL, AGENDA.propia, AGENDA.todas, AGENDA.agendar, ...Object.values(FACTURACION)],
  },
];

const EXPLORER = 'plugin::content-manager.explorer';

export default async (strapi: Core.Strapi): Promise<void> => {
  const roleService = strapi.service('admin::role');
  const permissionService = strapi.service('admin::permission');
  const contentTypeService = strapi.service('admin::content-type');
  const { actionProvider } = permissionService;

  for (const spec of ROLES_PANEL) {
    let rol = await strapi.db.query('admin::role').findOne({ where: { name: spec.name } });
    if (!rol) {
      rol = await roleService.create({ name: spec.name, description: spec.description });
      strapi.log.info(`[admin-roles] creado el rol del panel "${spec.name}"`);
    }

    // Lo que ya tiene, como `accion|subject`.
    const actuales = await strapi.db.query('admin::permission').findMany({ where: { role: { id: rol.id } } });
    const tiene = new Set(actuales.map((p: any) => `${p.action}|${p.subject ?? ''}`));

    // Permisos del Content Manager: agrupados por verbo, con la lista de
    // campos que Strapi generaría si se marcaran en Ajustes → Roles.
    const porVerbo = new Map<string, Set<string>>();
    for (const c of spec.concesiones) {
      for (const verbo of c.verbos) {
        if (!porVerbo.has(verbo)) porVerbo.set(verbo, new Set());
        c.subjects.forEach((s) => porVerbo.get(verbo)!.add(s));
      }
    }

    const acciones = [...porVerbo].map(([verbo, subjects]) => {
      const accion = actionProvider.get(`${EXPLORER}.${verbo}`);
      const existe = (uid: string) => Object.prototype.hasOwnProperty.call(strapi.contentTypes, uid);
      return { ...accion, subjects: [...subjects].filter(existe) };
    });
    const deContenido = contentTypeService.getPermissionsWithNestedFields(acciones);

    const otras = spec.otras
      .filter((id) => {
        if (actionProvider.has(id)) return true;
        strapi.log.warn(`[admin-roles] la acción ${id} no está registrada; se omite`);
        return false;
      })
      .map((action) => ({ action, subject: null, properties: {}, conditions: [] }));

    const faltan = [...deContenido, ...otras].filter((p: any) => !tiene.has(`${p.action}|${p.subject ?? ''}`));
    if (faltan.length > 0) {
      await roleService.addPermissions(rol.id, faltan);
      strapi.log.info(`[admin-roles] ${spec.name}: ${faltan.length} permisos añadidos`);
    }

    // Un permiso del Content Manager guarda la LISTA de campos que deja ver y
    // editar. Si el esquema gana un campo (`consultation.lines`,
    // `service.tax`), el permiso ya existe y el filtro de arriba no lo toca:
    // el campo quedaría invisible en el formulario para ese rol, sin error.
    // Aquí se añaden los campos que falten a los permisos que ya había.
    const porClave = new Map(actuales.map((p: any) => [`${p.action}|${p.subject ?? ''}`, p]));
    let ampliados = 0;
    for (const deseado of deContenido as any[]) {
      const actual: any = porClave.get(`${deseado.action}|${deseado.subject ?? ''}`);
      const quiere: string[] | undefined = deseado.properties?.fields;
      const tieneCampos: string[] | undefined = actual?.properties?.fields;
      if (!actual || !Array.isArray(quiere) || !Array.isArray(tieneCampos)) continue;
      const nuevos = quiere.filter((f) => !tieneCampos.includes(f));
      if (nuevos.length === 0) continue;
      await strapi.db.query('admin::permission').update({
        where: { id: actual.id },
        data: { properties: { ...actual.properties, fields: [...tieneCampos, ...nuevos] } },
      });
      ampliados++;
    }
    if (ampliados > 0) {
      strapi.log.info(`[admin-roles] ${spec.name}: ${ampliados} permisos con campos nuevos`);
    }
  }
};
