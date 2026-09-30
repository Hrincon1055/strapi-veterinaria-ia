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
  'api::catalog.product': 'searchLabel',
  'api::billing.subscription': 'searchLabel',
  'api::shared.contact': 'searchLabel',
  'api::notification.notification-recipient': 'searchLabel',
  
  'api::marketing.campaign-metric': 'searchLabel',

  /**
   * Las cuentas se identifican por su correo, no por el `username`.
   *
   * La del panel (`admin::user`) es la del staff: la apuntan vet,
   * responsible, staff, author y verifiedBy. Strapi elegiría
   * `firstname`, que se repite entre personas. Para que el selector la muestre,
   * el rol necesita `admin::users.read` (ver `admin-roles.ts`).
   */
  'admin::user': 'email',

  /**
   * La de la app (users-permissions) ya solo la apunta `profile.user`: el
   * staff se migró al panel y solo quedan clientes.
   *
   * Ojo: en Strapi 5 `unique: true` se valida en la capa de aplicación y no
   * hay índice único sobre `email` en `up_users`. La unicidad la sostienen el
   * ajuste `unique_email` del plugin y la comprobación de
   * `src/api/identity/services/portal.ts`.
   */
  'plugin::users-permissions.user': 'email',

  // Reapuntados a un campo que ya existía: no hizo falta tocar el esquema.
  'api::notification.notification': 'title',
  'api::customer.customer-note': 'body',
  'api::documents.signed-document-event': 'eventType',
  // `lockedBy` es privado; `idempotencyKey` es único y sí identifica el envío.
  'api::notification.notification-delivery': 'idempotencyKey',
  // Número, cliente y fecha (ver src/labels.ts). Antes fue `currency` ("COP"
  // en todas) y luego `dataicoInvoiceId`, vacío hasta la factura electrónica.
  'api::billing.invoice': 'searchLabel',
  'api::billing.invoice-item': 'description',
};

/**
 * Main field de componentes de dynamic zone, y de solo lectura.
 *
 * Con el bloque cerrado, el panel pinta en la cabecera el icono, el nombre del
 * componente y el valor de su main field (content-manager
 * `DynamicZone/DynamicComponent`). El main field tiene que ser un campo de
 * texto: una relación no sirve. Por eso las líneas de la consulta llevan
 * `label`, que rellena el servidor con el nombre del servicio o producto
 * (`validations/clinical.ts`); sin esto todas las cabeceras dirían solo
 * "Producto". Se marca no editable porque el servidor lo sobrescribe igual.
 */
const MAIN_FIELDS_COMPONENTES: Record<string, string> = {
  'clinical.service-line': 'label',
  'clinical.product-line': 'label',
};

/**
 * Otros campos de componente que escribe solo el servidor. `lineKey` es la
 * clave con la que un renglón de factura señala la línea que cobra
 * (`validations/clinical.ts`): se deja a la vista, sin editar, para poder
 * cruzar una línea con su factura.
 */
const SOLO_LECTURA_COMPONENTES: Record<string, string[]> = {
  'clinical.service-line': ['lineKey'],
  'clinical.product-line': ['lineKey'],
};

/**
 * Campos de content types que escribe solo el servidor
 * (`validations/billing.ts`): totales, numeración y datos congelados al
 * emitir, importes y claves de trazabilidad del renglón. Editarlos a mano
 * sería inútil —el servidor los descarta o los recalcula— y confuso.
 */
const SOLO_LECTURA: Record<string, string[]> = {
  'api::billing.invoice': [
    'subtotal', 'discountTotal', 'taxTotal', 'amount',
    'prefix', 'number', 'fullNumber', 'resolutionNumber', 'resolutionDate',
    'resolutionRangeFrom', 'resolutionRangeTo', 'resolutionValidUntil',
    'issuedAt', 'voidedAt', 'buyer', 'issuerSnapshot',
  ],
  'api::billing.invoice-item': ['lockKey', 'lineSubtotal', 'lineTax', 'lineTotal'],
};

/**
 * `strapi.store` ya antepone `plugin_content_manager_configuration_`, así que
 * la clave aquí es solo la parte final. En la tabla se ve como
 * `plugin_content_manager_configuration_content_types::api::pet.pet`.
 */
const PREFIJO = 'content_types::';

export default async (strapi: Core.Strapi): Promise<void> => {
  const store = strapi.store({ type: 'plugin', name: 'content_manager_configuration' });

  // Qué campo de relación de cada content type —y de cada componente— apunta
  // a un destino que cambia. Los componentes cuentan: el selector de producto
  // de una línea de consulta vive en `clinical.product-line`, y su
  // configuración está en `components::<uid>`, no en la de la consulta.
  const aCorregir: Array<{ key: string; campo: string; mainField: string }> = [];
  const origenes = [
    ...Object.entries(strapi.contentTypes).map(([uid, s]) => [`${PREFIJO}${uid}`, s] as const),
    ...Object.entries(strapi.components).map(([uid, s]) => [`components::${uid}`, s] as const),
  ];
  for (const [key, schema] of origenes) {
    for (const [campo, attr] of Object.entries((schema as any).attributes ?? {})) {
      const a = attr as any;
      if (a.type !== 'relation') continue;
      const deseado = MAIN_FIELDS[a.target];
      if (deseado) aCorregir.push({ key, campo, mainField: deseado });
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
  const porClave = new Map<string, Array<{ campo: string; mainField: string }>>();
  for (const r of aCorregir) {
    if (!porClave.has(r.key)) porClave.set(r.key, []);
    porClave.get(r.key)!.push({ campo: r.campo, mainField: r.mainField });
  }

  for (const [key, campos] of porClave) {
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

  // 3. main field (y solo lectura) de los componentes de dynamic zone.
  for (const [uid, mainField] of Object.entries(MAIN_FIELDS_COMPONENTES)) {
    const key = `components::${uid}`;
    const config: any = await store.get({ key });
    if (!config?.settings) continue;

    let tocado = false;
    if (config.settings.mainField !== mainField) {
      config.settings = { ...config.settings, mainField };
      tocado = true;
    }
    const edit = config.metadatas?.[mainField]?.edit;
    if (edit && edit.editable !== false) {
      edit.editable = false;
      tocado = true;
    }
    if (tocado) {
      await store.set({ key, value: config });
      cambios++;
    }
  }

  // 4. campos que solo escribe el servidor, en componentes y content types.
  // Todo `searchLabel` que sea main field lo recalcula `validations/labels.ts`
  // en cada escritura: se deja a la vista (oculto dejaría de ser listable y el
  // selector volvería al documentId) pero sin editar.
  const etiquetas = Object.entries(MAIN_FIELDS)
    .filter(([, campo]) => campo === 'searchLabel')
    .map(([uid]) => [`${PREFIJO}${uid}`, ['searchLabel']] as const);
  const soloLectura = [
    ...Object.entries(SOLO_LECTURA_COMPONENTES).map(([uid, c]) => [`components::${uid}`, c] as const),
    ...Object.entries(SOLO_LECTURA).map(([uid, c]) => [`${PREFIJO}${uid}`, c] as const),
    ...etiquetas,
  ];
  for (const [key, campos] of soloLectura) {
    const config: any = await store.get({ key });
    if (!config?.metadatas) continue;

    let tocado = false;
    for (const campo of campos) {
      const edit = config.metadatas[campo]?.edit;
      if (edit && edit.editable !== false) {
        edit.editable = false;
        tocado = true;
      }
    }
    if (tocado) {
      await store.set({ key, value: config });
      cambios++;
    }
  }

  // 5. `searchLabel` siempre como columna de la lista, detrás del id: es lo
  // que identifica el registro y lo que cruza la búsqueda (nombre, documento,
  // dueño…). Si alguien la quita en "Configurar la vista", vuelve al arrancar.
  for (const [key] of etiquetas) {
    const config: any = await store.get({ key });
    const lista: string[] | undefined = config?.layouts?.list;
    if (!Array.isArray(lista) || lista.includes('searchLabel')) continue;

    const pos = lista[0] === 'id' ? 1 : 0;
    config.layouts.list = [...lista.slice(0, pos), 'searchLabel', ...lista.slice(pos)];
    const meta = config.metadatas?.searchLabel?.list;
    if (meta) meta.searchable = meta.sortable = true;
    await store.set({ key, value: config });
    cambios++;
  }

  if (cambios > 0) {
    strapi.log.info(`[main-fields] ${cambios} configuraciones del panel actualizadas`);
  }
};
