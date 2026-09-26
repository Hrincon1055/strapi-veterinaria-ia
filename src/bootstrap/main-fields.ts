import type { Core } from '@strapi/strapi';

/**
 * Declara qué campo muestra el panel para cada content type.
 *
 * Strapi elige el main field solo: el primer campo de texto en orden de
 * declaración. El resultado por defecto en este modelo era malo — `customer`
 * mostraba `referralNotes` (casi siempre vacío), `consultation` un
 * `documentId` aleatorio y `subscription` el `paymentMethodToken`, que es un
 * campo privado.
 *
 * Hay que escribir en DOS sitios, y este es el detalle que hace que no baste
 * con cambiarlo en el panel del destino:
 *
 *  1. `settings.mainField` del propio content type (listados, cabeceras).
 *  2. `metadatas.<campo>.edit.mainField` de CADA content type que lo apunte.
 *     El selector de relación lee de aquí, no del destino
 *     (`content-manager/.../relations.js`: `metadatas.${targetField}.edit.mainField`).
 *
 * Es idempotente: solo escribe lo que difiere de lo deseado.
 */

/** Main field deseado por content type. */
const MAIN_FIELDS: Record<string, string> = {
  // Con `searchLabel` nuevo (ver src/labels.ts).
  'api::identity.profile': 'searchLabel',
  'api::customer.customer': 'searchLabel',
  'api::pet.pet': 'searchLabel',
  'api::pet.breed': 'searchLabel',
  'api::clinical.consultation': 'searchLabel',
  'api::billing.subscription': 'searchLabel',
  'api::shared.contact': 'searchLabel',
  'api::notification.notification-recipient': 'searchLabel',
  'api::scheduling.consultation-service': 'searchLabel',
  'api::marketing.campaign-metric': 'searchLabel',

  // Reapuntados a un campo que ya existía: no hizo falta tocar el esquema.
  'api::notification.notification': 'title',
  'api::customer.customer-note': 'body',
  'api::documents.signed-document-event': 'eventType',
  // `lockedBy` es privado; `idempotencyKey` es único y sí identifica el envío.
  'api::notification.notification-delivery': 'idempotencyKey',
  // `currency` decía "COP" en todas las facturas.
  'api::billing.invoice': 'dataicoInvoiceId',
};

/**
 * `strapi.store` ya antepone `plugin_content_manager_configuration_`, así que
 * la clave aquí es solo la parte final. En la tabla se ve como
 * `plugin_content_manager_configuration_content_types::api::pet.pet`.
 */
const PREFIJO = 'content_types::';

export default async (strapi: Core.Strapi): Promise<void> => {
  const store = strapi.store({ type: 'plugin', name: 'content_manager_configuration' });

  // Qué campo de relación de cada content type apunta a un destino que cambia.
  const aCorregir: Array<{ uid: string; campo: string; mainField: string }> = [];
  for (const [uid, schema] of Object.entries(strapi.contentTypes)) {
    for (const [campo, attr] of Object.entries((schema as any).attributes ?? {})) {
      const a = attr as any;
      if (a.type !== 'relation') continue;
      const deseado = MAIN_FIELDS[a.target];
      if (deseado) aCorregir.push({ uid, campo, mainField: deseado });
    }
  }

  let cambios = 0;

  // 1. settings.mainField de cada destino.
  for (const [uid, mainField] of Object.entries(MAIN_FIELDS)) {
    const key = `${PREFIJO}${uid}`;
    const config: any = await store.get({ key });
    if (!config?.settings || config.settings.mainField === mainField) continue;

    config.settings = { ...config.settings, mainField };
    await store.set({ key, value: config });
    cambios++;
  }

  // 2. metadatas.<campo>.edit.mainField de cada origen que apunte a ellos.
  const porUid = new Map<string, Array<{ campo: string; mainField: string }>>();
  for (const r of aCorregir) {
    if (!porUid.has(r.uid)) porUid.set(r.uid, []);
    porUid.get(r.uid)!.push({ campo: r.campo, mainField: r.mainField });
  }

  for (const [uid, campos] of porUid) {
    const key = `${PREFIJO}${uid}`;
    const config: any = await store.get({ key });
    if (!config?.metadatas) continue;

    let tocado = false;
    for (const { campo, mainField } of campos) {
      const meta = config.metadatas[campo];
      if (!meta?.edit || meta.edit.mainField === mainField) continue;
      meta.edit.mainField = mainField;
      tocado = true;
    }

    if (tocado) {
      await store.set({ key, value: config });
      cambios++;
    }
  }

  if (cambios > 0) {
    strapi.log.info(`[main-fields] ${cambios} configuraciones del panel actualizadas`);
  }
};
