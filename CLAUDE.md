# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Strapi 5 (v5.55.1) headless CMS in TypeScript for a veterinary clinic. 32 content types across 11 API domains, 6 components, and a replacement schema for the users-permissions `user`. The data model is specified in `strapi-veterinaria-prompt.md` — that document is the source of truth for field names, enum values and business rules; do not change either without changing it.

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
node demo-data.js [--reset]       # 3 sample clients with pets (idempotent); --reset removes them
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

## Environment

Copy `.env.example` to `.env` and fill the secrets (`APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`). `.env` and `.tmp/` are gitignored; the local sqlite database is disposable.
