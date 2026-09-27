# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Strapi 5 (v5.55.1) headless CMS in TypeScript for a veterinary clinic. 32 content types (uno es single type) across 12 API domains, 30 components, and a replacement schema for the users-permissions `user`. The data model is specified in `strapi-veterinaria-prompt.md` — that document is the source of truth for field names, enum values and business rules; do not change either without changing it.

Key model decisions (all deliberate, do not "fix"): no multi-tenant, no soft delete except an `archivedAt` datetime on six types (catalogs use `isActive` instead), Draft & Publish off everywhere, roles and permissions are 100% native users-permissions with no custom RBAC tables, and there is no `medical-history` — consultations, vaccinations and allergies hang directly off the pet.

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
node smoke-validations.js         # 27 live assertions against the business rules (boots Strapi, self-cleaning)
node demo-data.js [--reset]       # 3 sample clients with pets + Kira's clinical history (idempotent)
node demo-historia.js <mascota>   # prints a pet's full clinical history from the dynamic zone
node verify-model-doc.js          # checks strapi-veterinaria-prompt.md still matches the code
node audit-orphans.js             # duplicate names + tables/dist left behind by a deleted type
#  GET /api/availability?staff=…&desde=…&hasta=…  huecos libres de un profesional
node demo-flujo.js                # walks the client-portal flow over HTTP against a running server
npm run strapi -- generate        # interactive scaffolder: content-type, controller, policy, middleware…
```

`npx tsc --noEmit` reports an error per content type if `types/generated/` is stale — run `ts:generate-types` first, not a fix to the source.

Los tres scripts de arriba arrancan su propia instancia de Strapi y compilan contra `dist/`, así que hay que **parar `npm run develop` antes de ejecutarlos** (si no, chocan con su recompilación). `demo-flujo.js` es la excepción: habla solo por HTTP y necesita el servidor en marcha.

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
| `api::clinical.populate-sections` | consultation | Rellena la dynamic zone de la historia |
| `api::travel.populate-requirements` | travel-case | Rellena la zona de requisitos |
| `api::marketing.populate-segment` | campaign | Rellena la zona de reglas de segmento |
| `api::pet.populate-history` | pet | Con `?historia=true`, la historia completa en una petición |

Tres reglas que respetan todos: el valor por defecto solo se pone **si el cliente no mandó el suyo**; los filtros de los atajos se **combinan** con los que ya vengan; y el parámetro del atajo se **borra** de la query antes de seguir — con `strictParams: true` una clave que Strapi no conoce hace fallar la petición entera.

**El orden de los middlewares de populate importa y no es intuitivo.** Los que rellenan una zona *mergean* sobre el populate existente; `query-defaults` en cambio *se abstiene* si ya hay uno. Por tanto `query-defaults` va **antes** y el de la zona después. Al revés —que fue como lo escribí primero— el populate por defecto no se aplica nunca y la respuesta pierde `vet`, `services` y el dueño, **sin ningún error**. El orden correcto es: `date-range` → `query-defaults` → `populate-<zona>`.

**Los defaults cambian según el rol.** `query-defaults` acepta `porRol`, y el rol está disponible porque la autenticación corre antes que los middlewares de ruta (`ctx.state.user.role.type`). La propiedad NO lo está: `ctx.state.ownership` la pone la policy, que corre después.

No es cosmético. En la agenda, recepción quiere la próxima cita primero (`startAt:asc`) y el cliente su historial más reciente (`startAt:desc`). Y poblarle `pet.owner` a un cliente es trabajo tirado: el saneado lo descarta porque no puede leer `customer`.

**Un populate que no aparece suele ser permisos, no el middleware.** El saneado descarta en silencio lo que el rol no puede leer; no hay error ni aviso, el campo simplemente falta. Ya pasó tres veces:

- `pet.owner` no llega a un cliente (no puede leer `customer`) — correcto, por eso no se le pide.
- `pet-vaccination.vaccine` no llegaba hasta que se concedió `api::clinical.vaccine` al rol `client`.
- **Ningún rol podía leer `plugin::users-permissions.user`**, así que todo populate de `vet`, `responsible`, `performedBy`, `author` y `verifiedBy` se descartaba para todos: la agenda no decía quién atiende y la consulta no decía qué veterinario la firmó. Ahora `LECTURA_USUARIOS` lo concede a los tres roles de staff, **nunca al cliente** — se lo permitiría listar `/api/users` entero.

Antes de depurar un middleware por un campo que falta, mira los permisos del rol.

**Hay tres dynamic zones, no una.** `consultation.sections` (historia clínica), `travel-case.requirements` (7 tipos de requisito de viaje, cada uno con sus datos: la titulación antirrábica tiene resultado en UI/ml y umbral, el permiso de importación tiene caducidad) y `campaign.segment` (6 reglas de segmentación). Las tres necesitan su middleware de populate y ninguna se puede filtrar con `filters`.

`campaign.segment` sustituyó al campo `json` `segmentCriteria`, que se pasaba **tal cual** como filtro de Strapi — había que escribir filtros a mano en el panel. Ahora `src/api/marketing/services/campaign.ts` traduce cada regla. La regla de suscripción es la excepción: se resuelve con una consulta propia porque `customer` no tiene relación inversa `subscriptions` (solo existe `subscription.customer`, manyToOne sin `inversedBy`), así que no hay camino de cliente a sus suscripciones en los filtros.

`audit-orphans.js` busca precisamente esa basura: nombres duplicados, tablas que Strapi ya no gestiona y archivos que sobreviven en `dist/`. No adivina por el nombre — arranca Strapi y compara contra `strapi.db.metadata`, que conoce hasta las tablas de enlace con nombre truncado y hasheado (`components_scheduling_consultation_services_performed_by_lnk` se guarda como `components_scheduling_consultatiobc665_performed_by_lnk`). Ejecútalo después de cada migración a componente.

**Borrar un content type deja basura que rompe la siguiente migración.** Al convertir `api::scheduling.consultation-service` en componente aparecieron tres trampas encadenadas, y conviene conocerlas antes de repetir la operación:

1. **TypeScript incremental no borra la salida de un archivo eliminado.** `dist/` seguía teniendo el content type y Strapi lo seguía registrando y recreando sus tablas. `npm run build` no lo arregla: hay que `rm -rf dist` primero.
2. **Strapi no elimina las tablas de un content type borrado** (es conservador para no perder datos). Quedan `consultation_services` y sus `*_lnk`, y colisionan con el componente nuevo.
3. **`strapi_database_schema` guarda una instantánea** contra la que Strapi compara. Si tocas tablas por fuera, queda desfasada; hay que vaciarla para forzar una resincronización.

Y como el campo debía seguir llamándose `services`, la migración fue **exportar a un archivo, cambiar el esquema, importar** (`migrate-consultation-services.js --export|--import`): no se puede tener a la vez la relación y el componente con el mismo nombre, y renombrar pierde el contenido.

**`api::clinic.clinic` es el único single type**: datos de la veterinaria, obligaciones tributarias y resoluciones de facturación DIAN. Lo leen todos los autenticados (la app necesita nombre, logo y horarios); solo `clinic_admin` puede modificarlo.

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

**Types are generated, not authored.** `types/generated/contentTypes.d.ts` and `components.d.ts` are regenerated by Strapi on `develop`/`build` from the schema JSON files. Never edit them by hand; change the schema (or use the admin Content-Type Builder in dev) and let them regenerate.

**Config is env-driven.** Every `config/*.ts` exports either a plain object or an `({ env }) => object` factory. Non-default choices already made here, worth preserving:

- `config/database.ts` — three client blocks (sqlite default, postgres, mysql) selected by `DATABASE_CLIENT` and validated with `isDatabaseClientKind`, which throws on an unknown value. sqlite file lives at `.tmp/data.db`.
- `config/api.ts` — `strictParams` on for both REST and the Document Service, plus `strictRelations`. Unknown query params are rejected rather than ignored, so malformed client queries surface as errors.
- `config/plugins.ts` — users-permissions uses `jwtManagement: 'refresh'` with httpOnly session cookies; upload enforces an allowlist of media types plus an explicit deny list (SVG and executables).
- `config/middlewares.ts` — the default ordered stack; order is significant, insert custom middleware at a deliberate position rather than appending.
- `config/admin.ts`, `config/server.ts` — secrets and `APP_KEYS` come from env with non-null assertions, so a missing var fails loudly at boot.

**Roles and seed run on every boot, idempotently.** `src/bootstrap/roles.ts` creates the four users-permissions roles (`client`, `receptionist`, `veterinarian`, `clinic_admin`) if missing and grants only the permissions that are not already present, so manual tweaks in the admin panel survive a restart. It also sets `client` as the default registration role. `src/bootstrap/seed.ts` seeds countries, species and service categories, matching on natural keys before inserting.

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

**`@offset-dev/strapi-calendar` ships all six of its routes with `auth: false`.** Unauthenticated, `GET /strapi-calendar/collections` dumps the schema of every content type, `POST /strapi-calendar/settings` repoints the calendar at any collection, and `GET /strapi-calendar/` then returns that collection's rows — chained, that is an anonymous read of patient data. `src/middlewares/protect-calendar.ts` (registered in `config/middlewares.ts`, right after `strapi::errors`) requires a valid admin JWT on `/strapi-calendar/*`. The plugin's own admin UI uses `getFetchClient`, which sends that token, so the panel still works. Verified: all six routes return 401 anonymously and 200 with an admin token. **Do not remove that middleware while this plugin is installed.** El otro plugin de terceros (`schema-visualizer`) usa rutas `type: admin` y ya está protegido (401 sin token).

**`strapi-csv-import-export` se desinstaló** (daba errores en el panel; era un 0.0.6 de terceros). Si algún día hace falta importar o exportar CSV, la decisión que había tomada sigue siendo válida: habilitar **solo catálogos**, nunca tablas con datos personales — el plugin filtra por colección y no por rol, así que exponer `profile` o `customer` daría a cualquier administrador una exportación completa de la base de pacientes en un clic.

`/documentation` is public by design. To close it in production, turn on Restricted Access in Settings → Documentation; the flag lives in the plugin store, not in `config/plugins.ts`.

## Environment

Copy `.env.example` to `.env` and fill the secrets (`APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`). `.env` and `.tmp/` are gitignored; the local sqlite database is disposable.
