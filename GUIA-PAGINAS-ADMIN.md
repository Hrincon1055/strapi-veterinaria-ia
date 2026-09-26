# Guía: páginas personalizadas en el panel, sin mover los roles

Para cuando montes las páginas del staff dentro del panel de Strapi.

La idea es la **opción 3**: el staff sigue viviendo en `users-permissions` y las 16 relaciones (`consultation.vet`, `appointment.responsible`, `verifiedBy`…) se quedan intactas. Se añade **una sola** relación puente y el panel resuelve quién es quién a través del `profile`.

```
admin::user  ──►  profile  ──►  plugin::users-permissions.user
 (entra al panel)   (la persona)    (lo que firma las consultas)
```

## Lo que ya está comprobado en este proyecto

Verificado ejecutando contra esta instancia, no leído en la documentación:

| Hecho | Estado |
| --- | --- |
| Crear roles de admin propios en Community | **Funciona** (se creó uno y se borró) |
| `actionProvider.registerMany` para permisos propios | Existe, y **solo se puede llamar dentro de `bootstrap()`** |
| `assignPermissions` sobre roles existentes | Disponible |
| Roles de admin actuales | `strapi-super-admin`, `strapi-editor`, `strapi-author` |
| `@strapi/sdk-plugin` | Instalado, v5.4.0 |
| Exporta `@strapi/strapi/admin` | `useRBAC`, `useAuth`, `useFetchClient`, `Layouts` |

**Sin comprobar, y es lo primero que hay que hacer:** que un `schema.json` propio pueda declarar una relación a `admin::user`. Hay 101 relaciones apuntándole, pero son los `createdBy`/`updatedBy` que **inyecta Strapi**, no declaradas en un esquema.

---

## Paso 0 — La prueba de 10 minutos (bloqueante)

En una rama aparte, añade a `src/api/identity/content-types/profile/schema.json`:

```json
"adminUser": {
  "type": "relation",
  "relation": "oneToOne",
  "target": "admin::user"
}
```

Luego `rm -rf dist && npm run develop`.

- **Arranca sin error** → sigue al paso 1.
- **Falla** → cae a la opción 2: los mismos roles de admin y los mismos permisos de página, pero sin enlace automático. Tendrías que resolver la persona por el correo (`admin_users.email` = `up_users.email`), que funciona pero es frágil si alguien cambia un correo.

No sigas hasta tener la respuesta. Todo lo demás depende de esto.

---

## Paso 1 — El puente

Con la relación aceptada, quedan tres cosas:

**Enlazar las cuentas.** Cada miembro del staff tendrá dos: la de admin (entra al panel) y la de `users-permissions` (la que firma las consultas). El `profile` las une. Añade un paso idempotente en `bootstrap()` que las empareje por documento de identidad o por correo, y que **avise por log** de los admins sin perfil: son cuentas que no podrán registrar nada clínico.

**Un helper que resuelva la identidad.** Lo vas a usar en cada endpoint de tus páginas:

```ts
// admin::user  ->  profile  ->  users-permissions.user
async function staffDesdeAdmin(strapi, adminUserId: number) {
  const perfil = await strapi.documents('api::identity.profile').findFirst({
    filters: { adminUser: { id: adminUserId } } as any,
    populate: ['user'] as any,
  });
  return { perfil, usuario: (perfil as any)?.user ?? null };
}
```

**Actualizar el documento de modelo.** `strapi-veterinaria-prompt.md` describe `profile`; añade ahí `adminUser` y ejecuta `node verify-model-doc.js`, que si no te avisará del desajuste.

---

## Paso 2 — El plugin y la página

Las páginas del panel van en un plugin; no hay generador en `strapi generate` para esto.

```bash
npx @strapi/sdk-plugin init veterinaria-panel
```

Y en `config/plugins.ts`:

```ts
'veterinaria-panel': { enabled: true, resolve: './src/plugins/veterinaria-panel' },
```

Registra el menú desde el `admin/src/index.ts` del plugin con `app.addMenuLink`. Ese es el único sitio donde aparece la página.

---

## Paso 3 — Permisos de página

**Registrar las acciones.** Obligatoriamente dentro de `bootstrap()` — comprobado: fuera de ahí lanza *"You can't register new actions outside of the bootstrap function"*.

```ts
await strapi.service('admin::permission').actionProvider.registerMany([
  { uid: 'agenda.ver',   displayName: 'Ver la agenda',        pluginName: 'veterinaria-panel', section: 'plugins' },
  { uid: 'agenda.editar',displayName: 'Modificar la agenda',  pluginName: 'veterinaria-panel', section: 'plugins' },
  { uid: 'historia.ver', displayName: 'Ver la historia clínica', pluginName: 'veterinaria-panel', section: 'plugins' },
]);
```

`pluginName` tiene que ser un plugin **registrado**; con uno inventado falla con *"is not an existing plugin"*.

**Asignarlas a los roles.** Decide primero si creas roles propios o reutilizas los tres nativos:

| | Roles propios | Los 3 nativos |
| --- | --- | --- |
| Mapeo | `receptionist`, `veterinarian`, `clinic_admin` | Author → recepción, Editor → veterinario, Super Admin → administración |
| Nombres en el panel | los tuyos | genéricos y confusos |
| Riesgo | la UI de gestión en Community no se pudo verificar | ninguno |

Empieza por los nativos. Si la interfaz te deja gestionar roles propios, migras después: es solo cambiar a qué rol se asignan las mismas acciones.

Al asignar, **manda siempre la lista completa**: `assignPermissions` reemplaza, no añade. Si pasas solo la nueva, borras las demás. Hazlo idempotente igual que `src/bootstrap/roles.ts`: lee lo que hay, añade lo que falta, vuelve a escribir.

**Comprobarlo en la página:**

```tsx
import { useRBAC } from '@strapi/strapi/admin';

const { allowedActions: { canVer } } = useRBAC([
  { action: 'plugin::veterinaria-panel.agenda.ver', subject: null },
]);
if (!canVer) return <p>No tienes acceso a la agenda.</p>;
```

El permiso del frontend es cosmético: **gatea siempre también el endpoint**. Una página oculta con una API abierta no protege nada.

---

## Paso 4 — Conservar los middlewares

Esto es lo que hace que la opción 3 valga la pena, y es fácil pasarlo por alto.

`query-defaults`, `date-range`, los cuatro `populate-*` y la policy `is-owner` viven en rutas de **content-api**. Si tu página llama a `/content-manager/*`, no pasa por ninguno: pierdes los atajos (`?pet=`, `?hoy=`), el populate de las tres dynamic zones y el orden por rol.

Con el puente tienes salida. Un endpoint de admin de tu plugin emite un JWT de `users-permissions` para el staff que corresponde, y la página llama a la API de contenido con él:

```ts
const { usuario } = await staffDesdeAdmin(strapi, ctx.state.user.id);
if (!usuario) return ctx.badRequest('Esta cuenta de admin no tiene perfil enlazado');
const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: usuario.id });
```

Desde ese momento `GET /api/consultations?pet=…&hoy=true` funciona igual que en la app del cliente, con todo lo construido.

Tres cautelas: ese endpoint **debe** exigir sesión de admin (es un emisor de credenciales); emite con vida corta; y no lo devuelvas al navegador si puedes evitarlo — mejor que el propio endpoint haga de proxy.

---

## Trampas conocidas

Salidas de trabajar este proyecto. Todas fallan en silencio:

- **`rm -rf dist` al eliminar o renombrar algo.** TypeScript incremental no borra la salida huérfana y Strapi sigue registrando lo que ya no existe.
- **Un campo que no llega suele ser permisos, no el middleware.** El saneado descarta sin avisar lo que el rol no puede leer. Ya pasó tres veces.
- **`strictParams: true`** hace fallar la petición entera ante una clave que Strapi no conoce. Todo parámetro propio se borra de la query tras traducirlo.
- **Orden de los middlewares de populate:** `query-defaults` primero, los `populate-<zona>` después. Al revés, el populate por defecto no se aplica nunca.
- **`admin::user` no es tuyo.** No le añadas campos ni esperes que `searchLabel` funcione ahí: es `visible: false` en el content-manager.

## Checklist

- [ ] Paso 0 pasa: Strapi acepta `profile.adminUser`
- [ ] Emparejamiento idempotente en `bootstrap()`, con log de admins sin perfil
- [ ] `adminUser` en el documento de modelo y `verify-model-doc.js` en verde
- [ ] Plugin creado y menú visible
- [ ] Acciones registradas en `bootstrap()` y asignadas leyendo-y-reescribiendo
- [ ] Cada endpoint gateado en servidor, no solo la página
- [ ] Una lectura verificada por HTTP con un atajo (`?pet=`) para confirmar que los middlewares siguen aplicando
- [ ] `node smoke-validations.js` sigue en verde
