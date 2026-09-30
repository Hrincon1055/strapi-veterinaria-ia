# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Strapi 5 (v5.55.1) headless CMS in TypeScript for a veterinary clinic. 38 content types (uno es single type) across 13 API domains, 40 components, and a replacement schema for the users-permissions `user`. The data model is specified in `strapi-veterinaria-prompt.md` — that document is the source of truth for field names, enum values and business rules; do not change either without changing it.

Key model decisions (all deliberate, do not "fix"): no multi-tenant, no soft delete except an `archivedAt` datetime on six types (catalogs use `isActive` instead), Draft & Publish off everywhere, roles and permissions are 100% native with no custom RBAC tables — **clients in users-permissions, staff in the admin panel** (see "El staff trabaja en el panel") — and there is no `medical-history` — consultations, vaccinations and allergies hang directly off the pet.

## Commands

```bash
npm run develop      # dev server with autoReload + admin rebuild (http://localhost:1337, admin at /admin)
npm run start        # run without autoReload (production-style)
npm run build        # build the admin panel
npm run console      # REPL with the `strapi` global loaded
npm run strapi -- <cmd>   # any Strapi CLI command
npm run upgrade:dry  # preview a Strapi version upgrade (then `npm run upgrade`)
```

```bash
npx strapi ts:generate-types      # regenerate types/generated/ after a schema change, without a full boot
npx tsc --noEmit                  # typecheck server code
node smoke-validations.js         # 40 live assertions against the business rules (boots Strapi, self-cleaning)
node demo-data.js [--reset]       # everything: 3 clients + pets, staff (panel accounts + schedules), Kira's history, clinic, this week's agenda, 3 sample invoices (idempotent; --reset also sweeps pet-less leftovers)
node demo-historia.js <mascota>   # prints a pet's full clinical history from the dynamic zone
node factura-pdf.js <FE129|documentId> [salida]   # PDF de una factura (o vista previa de un borrador) en .tmp/facturas/
node verify-model-doc.js          # checks strapi-veterinaria-prompt.md still matches the code
node audit-orphans.js             # duplicate names + tables/dist left behind by a deleted type
#  GET /api/availability?staff=…&desde=…&hasta=…  huecos libres de un profesional
node vincular-admin.js [correo doc|correo --quitar]   # enlaza una cuenta del panel con un perfil (sin argumentos, lista)
node migrate-staff-to-admin.js --export|--import      # ya ejecutada: staff de users-permissions al panel (ver abajo)
node migrate-consultation-lines.js [--dry]            # ya ejecutada: consultation.items -> dynamic zone consultation.lines (ver abajo)
node demo-agenda.js [--reset]     # solo las 7 citas de la semana en curso (demo-data.js ya las crea); útil al cambiar de semana
node demo-flujo.js                # walks the client-portal flow over HTTP against a running server
npm run strapi -- generate        # interactive scaffolder: content-type, controller, policy, middleware…
```

`npx tsc --noEmit` reports an error per content type if `types/generated/` is stale — run `ts:generate-types` first, not a fix to the source.

Los scripts de arriba arrancan su propia instancia de Strapi y compilan contra `dist/`, así que hay que **parar `npm run develop` antes de ejecutarlos** (si no, chocan con su recompilación). `demo-flujo.js` es la excepción: habla solo por HTTP y necesita el servidor en marcha.

**Para probar un endpoint de administrador por HTTP no sirve firmar un JWT.** Desde 5.55 la estrategia `admin` exige un *access token* con `sessionId` y una sesión viva. Se pide así, desde un script que cargue Strapi:

```js
const sm = app.sessionManager('admin');
const { token: refresh } = await sm.generateRefreshToken('1', 'un-dispositivo', { type: 'session' });
const { token } = await sm.generateAccessToken(refresh);   // este es el Bearer
```

Conviene cerrarla al terminar (`POST /admin/logout` con ese token): la sesión queda en la base y sigue siendo válida hasta que caduque.

There is **no test runner and no linter** configured. Don't invent `npm test` / `npm run lint`. `smoke-validations.js` is the stopgap until Jest lands: it boots Strapi against the dev database, asserts that invalid writes are rejected, and deletes everything it created (records are suffixed `SMOKE`). It cleans up at start too, so an interrupted run does not poison the next one.

## Architecture

**Runtime shape.** Strapi loads `config/*.ts` first, then the lifecycle in `src/index.ts` (`register()` before init, `bootstrap()` before serving), then auto-discovers everything under `src/api/<name>/`. Each API folder follows the fixed convention `content-types/<name>/schema.json`, `controllers/`, `services/`, `routes/` — the folder layout *is* the routing/DI wiring, so file placement matters more than imports. Several content types share one domain folder (`api::clinical.consultation`, `api::clinical.allergy`, …), which is why the folder name and the singular name differ.

**Las reglas de negocio viven en middleware del Document Service, no en los esquemas.** In Strapi 5 relations are stored in link tables (`*_lnk`), so any rule combining a relation with another field cannot be a database constraint — and `required: true` is not supported on relation attributes at all. `src/validations/` holds one module per domain, all registered from `register()` via `src/validations/index.ts`. Three pieces carry most of the weight:

- `helpers.ts` — `toDocumentId()` normalizes the several shapes a relation can arrive in (bare documentId, object, array, `set`/`connect`/`disconnect`); `loadCurrent()` + `effective()` merge incoming data with the stored entry, which is what makes cross-field rules correct on `update` and not just on `create`.
- `required-relations.ts` — one table replacing the missing `required` on relations.
- `archived.ts` — injects `archivedAt: { $null: true }` into reads of the six archivable types unless the query mentions `archivedAt` itself. "Deleting" in the app means setting `archivedAt`.

**Index creation is split in two on purpose.** Strapi runs user migrations inside `schema.sync`, *before* it creates the content-type tables, so on a fresh database `database/migrations/*.business-indexes.js` finds no tables and skips them. `src/bootstrap/indexes.ts` then creates them in `bootstrap()`, once the schema exists, reading the index list from that same migration file (resolved through `strapi.dirs.app.root`, since `database/` is not compiled into `dist/`). The migration is the single source of truth; don't duplicate the SQL.

**Ownership is a route policy, not a role.** `src/policies/is-owner.ts` is attached to the routers of every content type a client can reach. It passes staff through untouched and only constrains users whose role type is `client`, walking `user → profile → customer → pets`. It injects a filter on list routes and checks the individual document on `:id` routes, because the Document Service resolves `findOne` by documentId where a filter would not apply.

**El alta del portal es un endpoint propio, no el `register` nativo.** `src/api/identity/` expone `POST /api/portal/register` y `/portal/claim/{start,complete}` (router personalizado en `routes/portal.ts`, lógica en `services/portal.ts`). El `register` nativo de users-permissions no sirve solo: crea el `user` pero no el `profile` ni el `customer`, y sin `customer` la policy `is-owner` deja al recién registrado sin ver nada.

Son dos caminos que no se deben mezclar. Si NO existe ficha con ese documento, `register` crea user + profile + customer + contactos en una transacción. Si SÍ existe (cliente de mostrador), `register` se niega y hay que pasar por la reclamación: se envía un código al contacto **que ya tenía la clínica**, nunca a uno aportado por quien pide, porque si no cualquiera se apropiaría de una ficha ajena adivinando una cédula. `claim/start` responde siempre lo mismo exista o no la ficha, para no convertirse en un comprobador de cédulas, y solo deja reclamar perfiles que tengan `customer` (así no se puede reclamar el perfil de un veterinario). El código se guarda como SHA-256 y se compara en tiempo constante.

El código es de 8 caracteres y no de 6 dígitos a propósito: `verification-code` no tiene contador de intentos, y sin él 10⁶ combinaciones se revientan dentro de la ventana de validez. Para volver al código corto de SMS hay que añadir `attemptCount` al esquema. Mientras no haya proveedor de SMS/correo, el código sale por `strapi.log` y, fuera de producción, en la respuesta como `codigoDesarrollo`.

**Los selectores de relación dependen de `searchLabel`, no del nombre.** Strapi elige el "main field" de cada content type solo (el primer campo de texto declarado) y la búsqueda del selector mira **solo ese campo** — el propio Strapi lo dice en `content-manager/.../relations.js`: *"searching should be allowed only on mainField for permission reasons"*. Los valores por defecto aquí eran malos: `customer` mostraba `referralNotes` (casi siempre vacío), `consultation` un `documentId`, y `subscription` el `paymentMethodToken`, que es privado (`isListable` no filtra por `private`).

Como Strapi no tiene campos calculados, la solución es una columna real. `src/labels.ts` define cómo se construye el `searchLabel` de cada uno de los 10 content types que lo tienen; `src/validations/labels.ts` lo recalcula tras cada escritura y **propaga en cascada** (cambiar el apellido de un perfil rehace las etiquetas de su cliente, contactos, mascotas y consultas); `src/bootstrap/backfill-labels.ts` rellena los que falten al arrancar.

`src/bootstrap/main-fields.ts` declara el main field, y hay que escribir en **dos** sitios: `settings.mainField` del destino Y `metadatas.<campo>.edit.mainField` de cada content type que lo apunte — el selector lee del origen, no del destino. Cambiarlo solo en el panel del destino no surte efecto en los formularios que ya existen.

No edites un `searchLabel` a mano: el middleware lo sobrescribe en la siguiente escritura. Y no lo ocultes del panel: un campo oculto deja de ser `isListable` y Strapi volvería a `documentId`.

**El staff trabaja en el panel; solo el cliente usa users-permissions.** Recepción, Veterinario y Administrador de clínica son roles del RBAC del panel (`src/bootstrap/admin-roles.ts`) y cada persona es un `admin::user`. Se migraron el 2026-09-28 con `migrate-staff-to-admin.js`, conservando el hash bcrypt: cada uno entra en `/admin` con su correo y su contraseña de siempre. Consecuencias que no son obvias:

- **Destinos.** `vet`, `responsible`, `staff`, `author` y `verifiedBy` → `admin::user`. (El servicio prestado tuvo un `performedBy` que se quitó: quien lo presta es el `vet` de la consulta.) `appointment.bookedBy` y `signed-document-event.performedBy` → `profile`, porque quien actúa puede ser un cliente o alguien del staff y el perfil es lo único que tienen los dos.
- **"Quién lo hizo" lo pone `src/validations/actor.ts`**, no un controlador: las escrituras del staff llegan por el Content Manager o por el plugin de agenda, no por los controladores de la API. Lee la sesión con `strapi.requestContext` y distingue `auth.strategy.name` (`admin` / `users-permissions`). Siempre sobrescribe lo que venga en la petición.
- **Sin `admin::users.read` el selector muestra el `documentId`.** Strapi declara ese permiso como alias de "leer `admin::user`" en el Content Manager (`admin-actions.js`, `aliases`), y `sanitizeMainField` cae a `documentId` si no se puede leer el main field. Por eso los tres roles lo llevan; el precio es que ven la lista de cuentas en Ajustes → Usuarios, solo lectura.
- **Cambiar el destino de una relación en SQLite no cambia su clave foránea.** `admin::user` y el `user` de users-permissions comparten `singularName`, así que la tabla de enlace conserva la columna `user_id`; Strapi actualiza su instantánea pero no puede alterar la FK (SQLite no admite `ALTER` de FK sin recrear la tabla). La tabla sigue apuntando a `up_users` sin aviso. La migración vacía esas tablas, las borra, vacía `strapi_database_schema` y deja que Strapi las recree — la trampa 3 de abajo, en otra forma.
- **Un token de API de acceso total sí ve esas relaciones**; ningún rol de users-permissions puede, porque `admin::user.find` no existe ahí.
- Los scripts de demo crean el personal con `demo-staff.js` (`cuentaDelPanel`), que deja el perfil enlazado. Contraseña de demo del staff: `Clinica12345`; la de los clientes, `Demo12345`. Hay una cuenta por rol del panel: Recepción (`andres.mejia`), Veterinario (`laura.gomez`, `sofia.arango`) y Administrador de clínica (`marta.lozano`), todas `@veterinaria.test`.

**El panel está en español en tres capas distintas**, y cada una vive en un sitio:

- **La interfaz de Strapi** (menús, botones): `src/admin/app.tsx` con `locales: ['es']`. Solo lo habilita; cada administrador lo elige en su perfil y queda en su navegador.
- **El nombre de cada entidad**: `info.displayName` del schema.json. Solo es texto de panel — el uid, las tablas y la API salen de `singularName`/`pluralName`, que siguen en inglés. Al cambiarlo hay que cambiar también el bloque del documento de modelo (`verify-model-doc.js` lo detecta en los componentes).
- **La etiqueta de cada campo**: `src/bootstrap/etiquetas-es.json`, aplicado en `bootstrap()` por `field-labels.ts` al mismo almacén que `main-fields.ts`. Solo reemplaza etiquetas que sigan siendo la de fábrica (igual al nombre del campo), así que un cambio hecho en "Configurar la vista" sobrevive — y corregir una traducción ya aplicada exige cambiarla también en el panel. Un campo nuevo sin entrada en el JSON sale en el log como `[field-labels] campos sin traducción`.

Los **valores de las enumeraciones** (`scheduled`, `no_show`, `absence`…) siguen en inglés en los desplegables: Strapi 5 no tiene etiqueta por valor de enum, y cambiar los valores rompería la API y el documento de modelo.

**La historia clínica es una dynamic zone, no tres campos.** `consultation.sections` sustituye a los antiguos `anamnesis`/`diagnosis`/`treatmentNotes`: el veterinario compone cada consulta con las secciones que necesita, de `src/components/clinical/` — anamnesis, physical-exam, lab-result, imaging, diagnosis, procedure y treatment-plan (que anida `clinical.medication` repetible). Esto **se aparta del documento de modelo** (sección 7.5), que define los tres campos; hay que actualizarlo.

Dos consecuencias que hay que conocer antes de tocar nada aquí:

- **Una dynamic zone no se puebla con `populate=*`.** Hay que enumerar cada componente bajo `on`, y los que llevan media o componentes anidados necesitan su propio `populate`. Si se olvida, la respuesta trae `sections: []` y parece que la consulta está vacía. Por eso `src/api/clinical/middlewares/populate-sections.ts` lo inyecta en `find` y `findOne` (ver `routes/consultation.ts`): la app pide `GET /api/consultations` a secas y recibe la historia completa. Respeta el `populate` que mande el cliente.
- **Los filtros de Strapi no atraviesan una dynamic zone.** No existe `filters[sections][condition]`. La búsqueda vive en `GET /api/consultations/search?section=clinical.diagnosis&q=…`, implementada en el servicio con el query engine sobre `consultations_cmps` + la tabla del componente, resolviendo después los documentos por la vía normal para que sigan pasando por el filtro de archivados y el saneado de salida. `clinical.medication` está anidado, así que su búsqueda sube dos saltos de `*_cmps`. Añadir un componente buscable = una entrada en `BUSCABLES`.

La ruta de búsqueda declara el handler completo (`api::clinical.consultation.searchBySection`) y no el relativo, porque la policy `is-owner` deduce el content type del handler.

`migrate-consultation-sections.js` hizo la migración de los tres campos a la zona, en dos fases: primero se añadió `sections` conservando los campos viejos, se migró (`--dry` para simular), y solo después se quitaron. En una sola fase se habría perdido el contenido, porque al quitar un atributo Strapi deja de exponerlo antes de que `bootstrap()` pueda leerlo.

**Los iconos de componente salen de una lista cerrada.** `info.icon` solo acepta uno de los 128 nombres de `COMPONENT_ICONS` (en `@strapi/content-type-builder/.../IconPicker/constants.js`). Un nombre inventado no falla ni avisa: el selector de la dynamic zone pinta el icono genérico de rejilla y las siete tarjetas quedan indistinguibles. Ya pasó con `stethoscope`, `crosshairs`, `clipboard` y `paperclip` — el clip se llama `attachment`. Antes de poner un icono, comprueba que esté en esa lista.

`verify-model-doc.js` comprueba que `strapi-veterinaria-prompt.md` sigue describiendo el código: compara cada bloque JSON del documento con su archivo, la dynamic zone con el esquema y el total de componentes. Ejecútalo tras tocar un componente — el documento lleva copias de los esquemas y se desincroniza en cuanto se cambia un icono.

**Los middlewares de ruta absorben la verbosidad de las consultas.** `strapi generate middleware` es interactivo y no corre sin terminal, así que están escritos a mano con su misma plantilla.

| Middleware | Dónde | Qué hace |
| --- | --- | --- |
| `global::query-defaults` | las 10 rutas de lectura | Traduce atajos (`?pet=`, `?estado=`, `?buscar=`, `?desde=`…) a `filters`, y pone `sort`/`populate` por defecto **según el rol** |
| `global::date-range` | todo lo que tiene fechas | Expande `?hoy=` / `?manana=` / `?semana=` / `?mes=` a `desde`/`hasta`, valida el formato (400 si no es AAAA-MM-DD real o el rango está invertido) y deja `ctx.state.rango` para los endpoints propios |
| `api::clinical.populate-sections` | consultation | Rellena las dos dynamic zones: la historia (`sections`) y los servicios y productos (`lines`) |
| `api::travel.populate-requirements` | travel-case | Rellena la zona de requisitos |
| `api::marketing.populate-segment` | campaign | Rellena la zona de reglas de segmento |
| `api::catalog.populate-details` | product | Rellena la zona de datos específicos del tipo de producto |
| `api::pet.populate-history` | pet | Con `?historia=true`, la historia completa en una petición |

Tres reglas que respetan todos: el valor por defecto solo se pone **si el cliente no mandó el suyo**; los filtros de los atajos se **combinan** con los que ya vengan; y el parámetro del atajo se **borra** de la query antes de seguir — con `strictParams: true` una clave que Strapi no conoce hace fallar la petición entera.

**El orden de los middlewares de populate importa y no es intuitivo.** Los que rellenan una zona *mergean* sobre el populate existente; `query-defaults` en cambio *se abstiene* si ya hay uno. Por tanto `query-defaults` va **antes** y el de la zona después. Al revés —que fue como lo escribí primero— el populate por defecto no se aplica nunca y la respuesta pierde `vet`, `services` y el dueño, **sin ningún error**. El orden correcto es: `date-range` → `query-defaults` → `populate-<zona>`.

**Los defaults cambian según el rol.** `query-defaults` acepta `porRol`, y el rol está disponible porque la autenticación corre antes que los middlewares de ruta (`ctx.state.user.role.type`). La propiedad NO lo está: `ctx.state.ownership` la pone la policy, que corre después.

No es cosmético. Desde que el staff está en el panel, por la API solo llegan clientes (`porRol.client`) e integraciones con token de API (la base, que no tiene rol). En la agenda la integración quiere la próxima cita primero (`startAt:asc`) y el cliente su historial más reciente (`startAt:desc`). Y poblarle `pet.owner` a un cliente es trabajo tirado: el saneado lo descarta porque no puede leer `customer`.

**No pidas `email` de un `admin::user` en un populate por defecto.** Es `private`, y con `strictParams` un campo privado en `fields` no se descarta: la petición entera falla con 400 *"Invalid key email"*, también la del cliente, aunque a él la relación se le quite después. Pasó en `?historia=true` durante la migración. Usa `firstname`/`lastname`.

**Un populate que no aparece suele ser permisos, no el middleware.** El saneado descarta en silencio lo que el rol no puede leer; no hay error ni aviso, el campo simplemente falta. Ya pasó tres veces:

- `pet.owner` no llega a un cliente (no puede leer `customer`) — correcto, por eso no se le pide.
- `pet-vaccination.vaccine` no llegaba hasta que se concedió `api::clinical.vaccine` al rol `client`.
- `vet`, `responsible`, `staff`, `author` y `verifiedBy` apuntan a `admin::user`, y **ningún rol de users-permissions puede tener `admin::user.find`**: por la API esas relaciones no le llegan a nadie salvo a un token de acceso total. Es lo buscado — al cliente nunca se le enseñó quién firmó.

Antes de depurar un middleware por un campo que falta, mira los permisos del rol.

**Hay cinco dynamic zones, no una.** `consultation.sections` (historia clínica), `consultation.lines` (servicios y productos), `travel-case.requirements` (7 tipos de requisito de viaje, cada uno con sus datos: la titulación antirrábica tiene resultado en UI/ml y umbral, el permiso de importación tiene caducidad), `campaign.segment` (6 reglas de segmentación) y `product.details` (datos propios de cada tipo de producto). Las cinco necesitan su middleware de populate y ninguna se puede filtrar con `filters`; por eso el producto lleva además `productType` como columna.

`campaign.segment` sustituyó al campo `json` `segmentCriteria`, que se pasaba **tal cual** como filtro de Strapi — había que escribir filtros a mano en el panel. Ahora `src/api/marketing/services/campaign.ts` traduce cada regla. La regla de suscripción es la excepción: se resuelve con una consulta propia porque `customer` no tiene relación inversa `subscriptions` (solo existe `subscription.customer`, manyToOne sin `inversedBy`), así que no hay camino de cliente a sus suscripciones en los filtros.

`audit-orphans.js` busca precisamente esa basura: nombres duplicados, tablas que Strapi ya no gestiona y archivos que sobreviven en `dist/`. No adivina por el nombre — arranca Strapi y compara contra `strapi.db.metadata`, que conoce hasta las tablas de enlace con nombre truncado y hasheado (`components_scheduling_consultation_services_performed_by_lnk` se guarda como `components_scheduling_consultatiobc665_performed_by_lnk`). Ejecútalo después de cada migración a componente.

**Borrar un content type deja basura que rompe la siguiente migración.** Al convertir `api::scheduling.consultation-service` en componente aparecieron tres trampas encadenadas, y conviene conocerlas antes de repetir la operación:

1. **TypeScript incremental no borra la salida de un archivo eliminado.** `dist/` seguía teniendo el content type y Strapi lo seguía registrando y recreando sus tablas. `npm run build` no lo arregla: hay que `rm -rf dist` primero.
2. **Strapi no elimina las tablas de un content type borrado** (es conservador para no perder datos). Quedan `consultation_services` y sus `*_lnk`, y colisionan con el componente nuevo.
3. **`strapi_database_schema` guarda una instantánea** contra la que Strapi compara. Si tocas tablas por fuera, queda desfasada; hay que vaciarla para forzar una resincronización.

Y como el campo debía seguir llamándose `services`, la migración fue **exportar a un archivo, cambiar el esquema, importar** (`migrate-consultation-services.js --export|--import`): no se puede tener a la vez la relación y el componente con el mismo nombre, y renombrar pierde el contenido.

**El catálogo comercial es un solo content type, `api::catalog.product`.** Medicamentos, vacunas, alimentos, juguetes, accesorios, higiene e insumos comparten tabla. Lo que los distingue es `productType` (filtrable, decide el comportamiento) y un bloque de datos propios en la dynamic zone `details` (`catalog.medication-details`, `vaccine-details`, `food-details`, `accessory-details`). `src/validations/catalog.ts` exige que ese bloque corresponda al tipo (`DETALLE_POR_TIPO`); es obligatorio en medicamentos y vacunas. Añadir un tipo de producto = un valor del enum y, si tiene datos propios, un componente + una entrada en `DETALLE_POR_TIPO` y en `api::catalog.populate-details`. Ni la consulta ni la futura facturación cambian. Decisiones que no conviene revertir:

- **Los servicios siguen siendo `api::scheduling.service`**, no un tipo de producto: tienen duración, agenda y huecos. Lo que comparten con el producto es el perfil tributario, `billing.tax-profile` (gravado exige tarifa 5 o 19; exento y excluido quedan en 0), para que la factura trate igual cualquier concepto.
- **Una vacuna del catálogo es una presentación comercial de la vacuna clínica** (`vaccine-details.vaccine` → `api::clinical.vaccine`), no un duplicado. El carné (`pet-vaccination`) sigue apuntando a la clínica.
- **Las existencias no se guardan en el producto.** Solo están las banderas (`tracksInventory`, `tracksBatches`, `minStock`), `referenceCost` (`private`, verificado que no sale por la API) y `preferredSupplier`. El stock saldrá de movimientos por lote, que es lo que da vencimientos y costo real; un campo `stock` editable se desincronizaría el primer día.
- **Proveedores (`supplier`) solo los ve el rol Administrador de clínica.** Sí se leen por API `product` y `product-category`: el cliente tiene que ver en su consulta lo que se le recomendó, y sin leer `product` el saneado lo quitaría de la línea.

**Servicios y productos de la consulta son una dynamic zone, `lines`.** Hay una tarjeta por tipo, con icono, como en la historia: `clinical.service-line` (Servicio, `handHeart`; estados `applied`/`recommended`) y `clinical.product-line` (Producto, `shoppingCart`; `applied`/`dispensed`/`recommended`). Cada una lleva un único selector, cantidad decimal y notas. "O servicio o producto" y "entregado solo para productos" los impone el esquema de cada tarjeta, no una regla. Sin precio: la facturación cobrará `applied` + `dispensed` con el precio del catálogo. Historia de la migración: `services` → `items` (componente repetible con dos selectores por línea, confuso en el panel) → `lines`, esta última con `migrate-consultation-lines.js` en dos fases.

- **`label` es el main field de cada tarjeta y lo pone el servidor.** Con el bloque cerrado, el panel pinta en la cabecera el icono, el nombre del componente y el valor del main field (`content-manager/.../DynamicZone/DynamicComponent`). Ese main field tiene que ser un campo de texto: una relación no sirve. Sin `label`, todas las cabeceras dirían solo "Producto". `validations/clinical.ts` lo rellena en cada escritura (nombre del servicio, `searchLabel` del producto) y `main-fields.ts` lo declara main field y no editable (`MAIN_FIELDS_COMPONENTES`). Solo aparece después de guardar.
- **`lineKey` es la identidad de la línea para la facturación** (UUID, lo pone `validations/clinical.ts`). Se conserva emparejando por `id` del componente; una clave entrante solo se respeta si ya era de una línea de esa consulta (un cliente de la API que reenvía la zona sin `id`), y un bloque duplicado en el panel recibe una nueva. No uses el `id` del componente como referencia desde fuera: no sobrevive a una migración de la zona. Diseño completo de la facturación: sección 5.5 del documento de modelo.
- **La zona la rellena `populate-sections`**, que ahora inyecta las dos zonas de la consulta. La historia de la mascota (`populate-history`) y `demo-historia.js` la piden con su propio `on`. Añadir una tarjeta = una entrada en `LINEAS` (`validations/clinical.ts`), otra en `populate-sections` y otra en `populate-history`.
- **No se puede filtrar por la zona.** "Consultas que recomendaron el producto X" necesitaría un endpoint propio, como `/consultations/search` para las secciones.

**El panel manda las relaciones de un componente como diferencia.** En una línea que ya existía y cuya relación no se tocó llega `{ connect: [], disconnect: [] }`, y `toDocumentId` lo interpreta como "se está limpiando". Una regla que exija la relación rechazaría así cualquier edición hecha desde el panel. `relacionDeComponente()` + `porId()`/`previaDe()` (en `helpers.ts`) toman en ese caso la relación del componente guardado con el mismo `id`. Úsalos en cualquier regla sobre relaciones dentro de componentes o dynamic zones; las pruebas de humo lo cubren con ese mismo payload.

**Un campo nuevo no aparece para los roles del panel aunque tengan el permiso.** El permiso del Content Manager guarda la *lista de campos*, y `addPermissions` solo añade los permisos que faltan, no campos a los que ya existen. Así, `consultation.items` habría quedado invisible para Veterinario, sin ningún error. `admin-roles.ts` ahora amplía la lista de campos de los permisos existentes en cada arranque. Por la misma razón, `main-fields.ts` recorre también los componentes (`components::<uid>`): el selector de producto de una línea de consulta lee su main field de la configuración del componente, no de la de la consulta.

**Facturación: la factura es cabecera + renglones (`api::billing.invoice-item`), y las reglas viven en `validations/billing.ts`.** Diseño y decisiones en la sección 5.5 del documento de modelo; se implementa por fases. Lo que no se ve leyendo un solo archivo:

- **Los totales de la factura solo cambian por `recalcularFactura`**, que escribe con `strapi.db.query` a propósito: el middleware descarta cualquier total que llegue por el Document Service, porque el panel reenvía el formulario entero al guardar.
- **"Emitida = congelada" compara con lo guardado**, no mira qué claves llegan. Sin eso, guardar desde el panel una factura emitida (p. ej. para marcarla pagada) se rechazaría por reenviar campos sin cambios.
- **No facturar dos veces descansa en `lockKey`** (= `lineKey` de la línea) + el índice único parcial `ux_invoice_items_lock`. Anular pone `lockKey = null` en sus renglones; borrar un borrador borra sus renglones (Strapi no borra en cascada y un renglón huérfano retendría la línea para siempre).
- **Lo puro va en `src/api/billing/domain/`** (cálculo e impuestos, registro de fuentes facturables). No en `services/`: Strapi registra como servicio cada archivo de esa carpeta. Carga solo sus carpetas conocidas, así que `domain/` no la toca.
- **Un servicio o producto sin perfil tributario no se puede facturar** (error explícito, nunca un IVA supuesto). Los servicios de la demo van gravados al 19 % (`IVA_SERVICIOS` en `demo-clinica.js`, decidido el 2026-09-29 y pendiente de confirmar con el contador).
- **La consulta también se bloquea**: `validations/clinical.ts` impide quitar, cambiar de concepto o de cantidad, o dejar de ser facturable una línea que cobra un renglón vivo, y borrar, archivar o cambiar de mascota una consulta cobrada. Para corregirla, primero se quita del borrador o se anula la factura.
- **Solo `invoicing.emitir` pasa una factura a emitida.** La regla lo exige con un `AsyncLocalStorage` (`domain/emision.ts`) porque la marca tiene que atravesar el Document Service. El consecutivo sube con un `UPDATE` condicional sobre la tabla del componente `billing.dian-resolution`, con el `trx` de `strapi.db.transaction`: no por el Document Service, que reescribiría la lista entera de resoluciones de Clínica. `validations/clinic.ts` ignora el `currentNumber` que mande el formulario de Clínica. Las pruebas de humo consumen números de la resolución de la demo y los devuelven al terminar.
- **El PDF (PDFKit) se genera bajo demanda y no se guarda** (`api::billing.invoice-pdf`, dibujo en `domain/documento-pdf.ts`): la Media Library sirve sus archivos públicos por URL. Usa las fuentes estándar de PDF, cuya codificación (WinAnsi) no tiene todos los caracteres: el signo menos `−` (U+2212) salía como `"`. Las tildes, la ñ, `·` y `—` sí están. El logo solo se pinta si es PNG o JPEG; otro formato se omite sin fallar.
- **Facturas de muestra: `demo-facturas.js`** (lo llama `demo-data.js`). Sobre la historia de Kira crea una emitida y pagada, una anulada y un borrador con lo cobrable de cada consulta. Crea también la cuenta de la administración, `marta.lozano@veterinaria.test`, la única demo que puede anular. En `--reset` va **la primera**: una consulta cobrada no se puede borrar. Borra las facturas con el query engine y devuelve el consecutivo solo si lo último emitido era suyo.
- **"Resolución usada" = hay facturas emitidas que la citan**, no `currentNumber` puesto. Con el segundo criterio `demo-data.js --reset` dejó de funcionar: la resolución de la demo nace en 128, así que se consideraba usada y `borrarClinica` no podía vaciar la lista.
- **`api::billing.invoicing` orquesta, no valida**: estado por consulta, bandeja de pendientes y `crearBorrador` (en `strapi.db.transaction`, que envuelve también las llamadas al Document Service: si un concepto falla no queda borrador a medias — verificado en las pruebas de humo).

**No uses `status` como nombre de atributo.** Está en la lista de reservados del documento de modelo (sección 11) y choca con el parámetro de Draft & Publish. Aquí el estado siempre es `state`. `verify-model-doc.js` lo comprueba.

**`R-99-PN` no significa "no responsable de IVA".** En la lista de responsabilidades fiscales de la DIAN es "No aplica – Otros"; si se es o no responsable de IVA lo dice `taxRegime`. `responsable_iva` + `r_99_pn` (lo que tiene la demo) es coherente. O-13 (gran contribuyente) y O-15 (autorretenedor) no se ponen "para cuadrar": son obligaciones reales.

**Los scripts de Python en Windows escriben CRLF.** Un `open(p, 'w')` convierte `\n` en `\r\n`, y con eso el documento de modelo dejó de encajar con las expresiones de `verify-model-doc.js`: el script dijo "coherente" comparando 0 bloques. Si parcheas con Python, abre con `newline=''` o `newline='\n'`. Git hace lo mismo: el repo tiene `core.autocrlf=true`, y un `git stash pop` devolvió los archivos en CRLF y volvió a pasar. Desde entonces `verify-model-doc.js` normaliza los finales de línea y falla si no encuentra ningún bloque.

**`api::clinic.clinic` es el único single type**: datos de la veterinaria, obligaciones tributarias y resoluciones de facturación DIAN. Lo leen el cliente por la API y todo el staff en el panel (la app necesita nombre, logo y horarios); solo el rol del panel Administrador de clínica puede modificarlo.

Cuatro decisiones que no conviene revertir:

- **Las credenciales no van ahí.** Claves de Dataico y certificado de firma se quedan en `.env`: el content type se lee por API, sale en la documentación OpenAPI y es exportable a CSV.
- **`resolutions` es repetible.** Una resolución DIAN caduca y las vencidas hay que conservarlas: una factura de 2025 se ampara en la resolución de 2025. Solo una lleva `isActive`.
- **`technicalKey` es `private`** — verificado que no sale en la respuesta.
- **El dígito de verificación se valida contra el NIT** con el módulo 11 de la DIAN (`digitoVerificacion` en `src/validations/clinic.ts`). Un DV mal escrito hace que la DIAN rechace todas las facturas y el error no aparece hasta intentar emitir. `demo-clinic.js` lo **calcula** en vez de escribirlo, para que el seed no choque con su propia validación.

**Un single type no se escribe con `documents().update({data})`.** Sin `documentId` valida pero no escribe nada, y falla en silencio — la tabla queda vacía y la API responde 404. Hay que usar `strapi.service(uid).createOrUpdate({data})`, que resuelve el documentId y crea si no existe. (`createOrUpdate` está en el prototipo, así que no aparece en `Object.keys` del servicio.)

**El horario del personal y los huecos libres son cosa nuestra, no del plugin.** `@offset-dev/strapi-calendar` solo pinta registros que YA tienen fecha de inicio y fin: sus únicas opciones son `startField`, `endField`, `titleField`, `colorField`, `defaultDuration` y `drafts` (verificado en su código). No sabe nada de horarios recurrentes, duración por paciente, consultorios ni ausencias. Sirve para **ver** la agenda de `appointment`; no para configurarla.

El sistema propio son tres piezas:

- **`api::scheduling.staff-schedule`** — horario semanal de cualquier persona (veterinario, peluquero, cirujano, asistente): franjas por día (`scheduling.work-shift`, repetible), consultorio, minutos por paciente y vigencia. Varias franjas el mismo día modelan la pausa de almuerzo.
- **`api::scheduling.schedule-exception`** — rompe el horario en fechas concretas: `absence` quita disponibilidad, `extra_shift` la añade. Día completo o por horas.
- **`GET /api/availability?staff=&desde=&hasta=[&servicio=]`** — cruza horario + excepciones + citas que bloquean agenda y devuelve los huecos libres. Con `servicio`, la rejilla usa `defaultDurationMinutes` en vez del horario: una vacunación de 15 min genera 40 huecos donde una consulta de 45 genera 13.

Ese endpoint **no lleva policy de propiedad y el cliente lo puede llamar**: necesita ver los huecos para reservar en línea, y un hueco libre no es dato de nadie. Lo que no expone es de quién es cada tramo ocupado, solo que no está.

Dos reglas que evitan agendas imposibles: **un profesional no puede tener dos horarios activos con vigencias que se crucen** (el generador no sabría cuál aplicar) y **dos franjas del mismo día no pueden solaparse** (duplicaría los huecos). El generador nunca crea un hueco parcial: si en la franja caben 2,67 turnos, ofrece 2.

**No se valida que una cita caiga dentro del horario.** Es deliberado: las urgencias llegan fuera de hora y bloquear eso haría el sistema inservible justo cuando más importa. El horario propone, no impone.

**La agenda visual es un plugin local, `src/plugins/veterinaria-agenda/`.** Pinta la semana de uno o varios profesionales en una rejilla tipo Outlook, y desde una cita crea la consulta ya rellena. No reimplementa nada: los huecos se los pide a `api::scheduling.availability`. Arquitectura limpia en el panel — `domain/` (fechas y colores, sin dependencias), `infrastructure/` (el `fetchClient`), `application/` (el caso de uso) y `presentation/` (Zustand + Design System).

Cuatro cosas que hay que saber antes de tocarlo:

- **El profesional ES su cuenta del panel.** `responsible` y `staff` apuntan a `admin::user`, así que `/veterinaria-agenda/me` no necesita puente: la agenda propia existe si la cuenta tiene un `staff-schedule`. Sin horario (el Super Admin, por ejemplo) responde `enlazado: false` y la interfaz lo dice en vez de pintar un calendario vacío que parece un error. `profile.adminUser` solo aporta nombre completo, ocupación y el `bookedBy` de lo que esa persona agende.
- **El servidor no se fía de la interfaz.** Hay tres permisos (`agenda.ver-propia`, `agenda.ver-todas`, `agenda.agendar`) y el controlador vuelve a preguntar por ellos: quien no tenga `ver-todas` recibe su propia agenda aunque pida `?staff=<otro>`, y si además puede agendar, reservarle a otro da 403. Verificado con tres cuentas de rol restringido.
- **Mirar la agenda y llenarla son permisos distintos.** Un hueco libre solo es pulsable con `agenda.agendar`, que es de recepción: el veterinario atiende lo que ya tiene. Sin ese permiso los huecos se pintan como fondo inerte y `GET /pets` + `POST /appointments` responden 403 (política `puede-agendar`), así que ocultar el botón no es la protección.
- **Al reservar se vuelve a calcular el hueco.** `reservar()` no cree el `startAt` que llega: pide otra vez los huecos de ese día y exige que el pedido siga entre ellos. En recepción hay varias personas agendando sobre una rejilla que se pintó hace minutos, y sin esto se crearían dos citas en el mismo tramo. El `endAt` **no se acepta del cliente** — lo fija el hueco, o se podría pisar el tramo siguiente. Los dos motivos de rechazo se distinguen en el mensaje ("acaba de ocuparse" frente a "no es un hueco del horario"), porque se arreglan de forma distinta.
- **Al insertar la cita hay que quitar el hueco.** Los huecos no son registros: son el horario menos las citas. `agregarCita` en el store hace las dos cosas; si solo añadiera la cita, la rejilla pintaría encima un tramo que sigue diciendo "libre".
- **`admin::hasPermissions` es un AND, no un OR.** Su handler hace `permissions.every(…)`, así que declarar las dos acciones en una ruta solo dejaba pasar al Super Admin: un veterinario con `ver-propia` recibía 403 en su propia agenda. Por eso las rutas usan la política propia `plugin::veterinaria-agenda.puede-ver-agenda`, que hace `some`. En el panel no pasa lo mismo: los `permissions` de `addMenuLink` se evalúan con un `filter`, o sea OR.
- **Los permisos se registran pero no se asignan.** `server/bootstrap.js` solo llama a `actionProvider.registerMany`. El Super Admin las recibe solo; al resto se les conceden desde Ajustes → Roles. Asignarlas desde código con `assignPermissions` rompía el arranque (`[45] is not an existing permission action`) porque ese método **reemplaza** la lista completa del rol.

**La facturación del panel es otro plugin local, `src/plugins/veterinaria-facturacion/`**, con la misma arquitectura. No tiene lógica de negocio: el servidor delega en `api::billing.invoicing` e `api::billing.invoice-pdf`, y las reglas son las de `validations/billing.ts`. Lo que no es obvio:

- **Una sola política con configuración**, `tiene-permiso` (`{ config: { acciones: ['emitir'] } }`), que hace OR, en vez de una política por permiso. El precio manual de un renglón (D5) no tiene ruta propia: el controlador exige `cambiar-precio` y un `motivoPrecio` si el cuerpo trae `precioUnitario`. Ese permiso es solo de Administrador de clínica (y del Super Admin, que recibe todas las acciones registradas al arrancar): Recepción emite (D8) pero no cambia precios. La regla del renglón solo acepta un precio distinto del catálogo dentro de `conCambioDePrecio` (`domain/cambio-precio.ts`, mismo mecanismo que la emisión), porque Recepción tiene CRUD de `invoice-item` en el Content Manager y podría saltarse el controlador. El motivo queda en `priceOverrideReason`.
- **Varias páginas con `<Routes>` propias**: `addMenuLink` monta el plugin en `plugins/<id>/*`. Aquí `to` va sin `/` inicial y `Component` es `() => import(...)`; la agenda usa las formas antiguas, que Strapi marca como obsoletas en la consola.
- **El PDF se pide como Blob** (`fetchClient.get(url, { responseType: 'blob' })`): un enlace directo no lleva el token de la sesión.
- **Panel lateral de la consulta** con `app.getPlugin('content-manager').apis.addEditViewSidePanel` en `bootstrap`. Strapi lo llama con `{ model, documentId, … }` para cada documento; devolver `null` lo oculta. Muestra lo guardado, no lo que se está editando.
- **Botón "Facturar" de la agenda**: `AgendaPage` mira los permisos de la cuenta con `useAuth(…, (s) => s.permissions)` y solo lo pasa si hay alguno de facturación.
- **Verificado por HTTP con las cuentas de la demo**: 30 comprobaciones de permisos y del flujo completo con Recepción y Veterinario, y los cuatro permisos de Administrador de clínica con `marta.lozano@veterinaria.test`.

`strapi-admin.js` tiene que ser **ESM con `export default`** (`export { default } from './admin/src/index.jsx'`); en CommonJS el empaquetador del panel falla con *"default" is not exported*. `strapi-server.js` en cambio es CommonJS. Y el código del plugin va en `.js`, no en `.ts`: `config/plugins.ts` lo resuelve desde `./src/plugins/…`, así que Strapi cargaría el fuente sin compilar.

**Types are generated, not authored.** `types/generated/contentTypes.d.ts` and `components.d.ts` are regenerated by Strapi on `develop`/`build` from the schema JSON files. Never edit them by hand; change the schema (or use the admin Content-Type Builder in dev) and let them regenerate.

**Config is env-driven.** Every `config/*.ts` exports either a plain object or an `({ env }) => object` factory. Non-default choices already made here, worth preserving:

- `config/database.ts` — three client blocks (sqlite default, postgres, mysql) selected by `DATABASE_CLIENT` and validated with `isDatabaseClientKind`, which throws on an unknown value. sqlite file lives at `.tmp/data.db`.
- `config/api.ts` — `strictParams` on for both REST and the Document Service, plus `strictRelations`. Unknown query params are rejected rather than ignored, so malformed client queries surface as errors.
- `config/plugins.ts` — users-permissions uses `jwtManagement: 'refresh'` with httpOnly session cookies; upload enforces an allowlist of media types plus an explicit deny list (SVG and executables).
- `config/middlewares.ts` — the default ordered stack; order is significant, insert custom middleware at a deliberate position rather than appending.
- `config/admin.ts`, `config/server.ts` — secrets and `APP_KEYS` come from env with non-null assertions, so a missing var fails loudly at boot.

**Roles and seed run on every boot, idempotently.** `src/bootstrap/roles.ts` creates the users-permissions `client` role if missing (and Public's permissions) and grants only the permissions that are not already present, so manual tweaks in the admin panel survive a restart. It also sets `client` as the default registration role. `src/bootstrap/admin-roles.ts` does the same for the three panel roles (`Recepción`, `Veterinario`, `Administrador de clínica`) with `addPermissions` — never `assignPermissions`, which replaces the whole list. `src/bootstrap/seed.ts` seeds countries, species and service categories, matching on natural keys before inserting.

**Admin customization** is opt-in: `src/admin/app.example.tsx` and `vite.config.example.ts` must be renamed (drop `.example`) to take effect. `src/admin/` has its own tsconfig and is excluded from the server compilation.

**tsconfig** uses `module`/`moduleResolution: Node16` (changed from the scaffold's CommonJS/Node default), so relative imports in server code need explicit extensions where ESM resolution applies.

## Plugins

Four plugins beyond the defaults, all Strapi 5 compatible, configured in `config/plugins.ts`:

| Plugin | Where it shows up | Configuration |
| --- | --- | --- |
| `documentation` | `/documentation` | OpenAPI, regenerated each boot from the content types. Bump `info.version` to cut a new version instead of overwriting. |
| `color-picker` | Service form | Applied to `service.colorHex` as a custom field; the stored type is still `string`, so no data migration. |
| `strapi-calendar` | Admin menu | Solo **visualiza** `appointment` (colección y campos de fecha en Ajustes → Calendar, no en `plugins.ts`). Los horarios y los huecos son del sistema propio. **Ver la nota de seguridad.** |
| `schema-visualizer` | Admin menu | None. |

**`@offset-dev/strapi-calendar` ships all six of its routes with `auth: false`.** Unauthenticated, `GET /strapi-calendar/collections` dumps the schema of every content type, `POST /strapi-calendar/settings` repoints the calendar at any collection, and `GET /strapi-calendar/` then returns that collection's rows — chained, that is an anonymous read of patient data. `src/middlewares/protect-calendar.ts` (registered in `config/middlewares.ts`, right after `strapi::errors`) requires an active admin session on `/strapi-calendar/*`. The plugin's own admin UI uses `getFetchClient`, which sends that token, so the panel still works. Verified: the six routes return 401 anonymously and pass with a real panel token. **Do not remove that middleware while this plugin is installed.**

**Ese middleware valida con `strapi.sessionManager`, no con `jwt.verify`.** Desde 5.55 la estrategia `admin` ya no acepta un JWT suelto: exige un *access token* con `sessionId` y una sesión viva (`@strapi/admin/.../strategies/admin.js`). Comprobar solo la firma contra `admin.auth.secret` estaba mal en los dos sentidos y así estuvo escrito aquí: el token real del panel lleva `{ userId, sessionId, type: 'access' }` y no `{ id }`, así que **rechazaba al panel legítimo** (401 verificado), mientras que un JWT `{ id: 1 }` firmado a mano **sí pasaba**, porque nadie miraba si la sesión seguía activa. Ahora usa `validateAccessToken` + `isSessionActive`, igual que la estrategia de Strapi. Lo mismo vale para cualquier script de prueba: un token de administrador no se fabrica firmando, se pide con `strapi.sessionManager('admin').generateRefreshToken(...)` y luego `generateAccessToken(...)`.

La colección que pinta el calendario se configura en Ajustes → Calendar y vive en el plugin store: `api::scheduling.appointment` / `startAt` / `endAt`, título `title`, 45 min, de 7:00 a 18:00. Si `GET /strapi-calendar/` responde 500, es que esa configuración está vacía. El otro plugin de terceros (`schema-visualizer`) usa rutas `type: admin` y ya está protegido (401 sin token).

**`strapi-csv-import-export` se desinstaló** (daba errores en el panel; era un 0.0.6 de terceros). Si algún día hace falta importar o exportar CSV, la decisión que había tomada sigue siendo válida: habilitar **solo catálogos**, nunca tablas con datos personales — el plugin filtra por colección y no por rol, así que exponer `profile` o `customer` daría a cualquier administrador una exportación completa de la base de pacientes en un clic.

`/documentation` is public by design. To close it in production, turn on Restricted Access in Settings → Documentation; the flag lives in the plugin store, not in `config/plugins.ts`.

## Environment

Copy `.env.example` to `.env` and fill the secrets (`APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`). `.env` and `.tmp/` are gitignored; the local sqlite database is disposable.
