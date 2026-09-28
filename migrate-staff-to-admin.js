'use strict';

/**
 * Lleva al staff (Recepción, Veterinario, Administrador de clínica) de
 * `users-permissions` al panel de administración. El rol Cliente no se toca.
 *
 *   node migrate-staff-to-admin.js --export [--dry]   con el esquema VIEJO
 *   (cambiar los esquemas)
 *   node migrate-staff-to-admin.js --import           con el esquema NUEVO
 *
 * Qué cambia de destino:
 *  - vet, responsible, staff, author, performedBy (servicio prestado) y
 *    verifiedBy: de `plugin::users-permissions.user` a `admin::user`.
 *  - appointment.bookedBy y signed-document-event.performedBy: a
 *    `api::identity.profile`, porque quien actúa puede ser un cliente o alguien
 *    del staff y el perfil es lo único que tienen los dos.
 *
 * Por qué en dos pasos: `admin::user` y el user de users-permissions tienen el
 * mismo singularName, así que la tabla de enlace conserva la columna `user_id`
 * y Strapi solo reescribe la clave foránea al cambiar el destino. Las filas se
 * quedarían con IDs de `up_users` apuntando a `admin_users`: no falla nada, y
 * la consulta de Laura aparecería firmada por quien tenga su mismo id en el
 * panel. `--export` guarda las filas y VACÍA esas tablas antes del cambio;
 * `--import` las vuelve a escribir con los IDs nuevos.
 *
 * La contraseña se conserva: los dos plugins usan bcrypt y el hash se copia tal
 * cual. El archivo intermedio lleva esos hashes: está en `.tmp/` (ignorado por
 * git) y se debe borrar cuando la migración esté verificada.
 */

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const ARCHIVO = path.join(process.cwd(), '.tmp', 'migracion-staff.json');

const UP_USER = 'plugin::users-permissions.user';

/** Rol de users-permissions -> nombre del rol del panel que lo sustituye. */
const ROLES_STAFF = {
  receptionist: 'Recepción',
  veterinarian: 'Veterinario',
  clinic_admin: 'Administrador de clínica',
};

/** Relaciones que pasan a apuntar a una cuenta del panel. */
const A_ADMIN = [
  ['api::clinical.consultation', 'vet'],
  ['api::clinical.allergy', 'vet'],
  ['api::clinical.pet-vaccination', 'vet'],
  ['api::customer.customer-note', 'author'],
  ['api::scheduling.appointment', 'responsible'],
  ['api::scheduling.staff-schedule', 'staff'],
  ['api::scheduling.schedule-exception', 'staff'],
  ['scheduling.consultation-service', 'performedBy'],
  ['travel.antiparasitic', 'verifiedBy'],
  ['travel.crate', 'verifiedBy'],
  ['travel.health-certificate', 'verifiedBy'],
  ['travel.import-permit', 'verifiedBy'],
  ['travel.microchip-check', 'verifiedBy'],
  ['travel.other-requirement', 'verifiedBy'],
  ['travel.rabies-titer', 'verifiedBy'],
];

/** Relaciones de "quién lo hizo", que pasan a apuntar al perfil. */
const A_PERFIL = [
  ['api::scheduling.appointment', 'bookedBy'],
  ['api::documents.signed-document-event', 'performedBy'],
];

const clave = (uid, campo) => `${uid}.${campo}`;

/** Tabla de enlace y columnas de una relación, según el esquema cargado. */
function enlace(app, uid, campo) {
  const attr = app.db.metadata.get(uid).attributes[campo];
  if (!attr?.joinTable) throw new Error(`${clave(uid, campo)} no tiene tabla de enlace`);
  return {
    target: attr.target,
    tabla: attr.joinTable.name,
    propia: attr.joinTable.joinColumn.name,
    destino: attr.joinTable.inverseJoinColumn.name,
  };
}

async function exportar(app, dry) {
  for (const [uid, campo] of [...A_ADMIN, ...A_PERFIL]) {
    const { target } = enlace(app, uid, campo);
    if (target !== UP_USER) {
      throw new Error(`${clave(uid, campo)} ya apunta a ${target}: el esquema ya se cambió, esto es para --import`);
    }
  }

  const knex = app.db.connection;

  const roles = await app.db.query('plugin::users-permissions.role').findMany({
    where: { type: { $in: Object.keys(ROLES_STAFF) } },
    populate: ['permissions'],
  });

  const usuarios = await app.db.query(UP_USER).findMany({
    where: { role: { type: { $in: Object.keys(ROLES_STAFF) } } },
    populate: ['role', 'profile'],
  });
  const idsStaff = new Set(usuarios.map((u) => u.id));

  const vinculos = {};
  let avisos = 0;
  for (const [uid, campo] of A_ADMIN) {
    const e = enlace(app, uid, campo);
    const filas = await knex(e.tabla).select('*');
    for (const f of filas) {
      if (!idsStaff.has(f[e.destino])) {
        console.log(`  AVISO ${clave(uid, campo)}: apunta al usuario ${f[e.destino]}, que no es staff; se perderá`);
        avisos++;
      }
    }
    vinculos[clave(uid, campo)] = { ...e, filas };
  }

  // Quien actuó puede ser un cliente: se guarda el perfil de TODOS los
  // usuarios que aparecen, no solo del staff.
  const actores = {};
  const idsActores = new Set();
  for (const [uid, campo] of A_PERFIL) {
    const e = enlace(app, uid, campo);
    const filas = await knex(e.tabla).select('*');
    filas.forEach((f) => idsActores.add(f[e.destino]));
    actores[clave(uid, campo)] = { ...e, filas };
  }
  const perfilDe = {};
  if (idsActores.size > 0) {
    const conPerfil = await app.db.query(UP_USER).findMany({
      where: { id: { $in: [...idsActores] } },
      populate: ['profile'],
    });
    for (const u of conPerfil) perfilDe[u.id] = u.profile?.id ?? null;
  }

  const adminEnlaces = await knex('profiles_admin_user_lnk').select('*');

  const respaldo = {
    exportadoEl: new Date().toISOString(),
    usuarios: usuarios.map((u) => ({
      id: u.id,
      documentId: u.documentId,
      username: u.username,
      email: u.email,
      password: u.password,
      confirmed: u.confirmed,
      blocked: u.blocked,
      rol: u.role?.type,
      perfil: u.profile ? { id: u.profile.id, firstName: u.profile.firstName, lastName: u.profile.lastName } : null,
    })),
    roles: roles.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      description: r.description,
      permisos: (r.permissions ?? []).map((p) => p.action),
    })),
    vinculos,
    actores,
    perfilDe,
    adminEnlaces,
  };

  const total = (m) => Object.values(m).reduce((n, v) => n + v.filas.length, 0);
  console.log(`\n  staff: ${usuarios.map((u) => `${u.username} (${u.role?.type})`).join(', ')}`);
  console.log(`  roles: ${roles.map((r) => r.type).join(', ')}`);
  console.log(`  vínculos a cuenta del panel: ${total(vinculos)}`);
  console.log(`  vínculos de "quién lo hizo": ${total(actores)}`);
  if (avisos) console.log(`  ${avisos} vínculos no apuntan a staff (ver AVISO arriba)`);

  if (dry) {
    console.log('\n  --dry: no se escribió ni se vació nada.\n');
    return;
  }

  fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });
  fs.writeFileSync(ARCHIVO, JSON.stringify(respaldo, null, 2));

  await knex.transaction(async (trx) => {
    for (const v of [...Object.values(vinculos), ...Object.values(actores)]) {
      await trx(v.tabla).del();
    }
  });

  console.log(`\n  -> ${ARCHIVO}`);
  console.log('  Tablas de enlace vaciadas. Ahora cambia los esquemas y ejecuta con --import.\n');
}

/**
 * En SQLite, Strapi NO reescribe la clave foránea de una tabla de enlace
 * cuando cambia el destino de la relación: SQLite no admite ALTER de una FK
 * sin recrear la tabla. La instantánea `strapi_database_schema` sí se
 * actualiza, así que Strapi cree que ya está hecho y no lo vuelve a intentar.
 * Resultado: `consultations_vet_lnk.user_id` sigue apuntando a `up_users` y
 * cualquier inserción con el id de una cuenta del panel falla por FK.
 *
 * Arreglo: esas tablas están vacías tras `--export`, así que se borran y se
 * vacía la instantánea; en el siguiente arranque Strapi las crea de nuevo, ya
 * con la FK correcta. Devuelve true si hubo que hacerlo (y hay que relanzar).
 */
async function repararClaves(app) {
  const knex = app.db.connection;
  if (app.db.dialect.client !== 'sqlite') return false;

  const malas = [];
  for (const [uid, campo] of [...A_ADMIN, ...A_PERFIL]) {
    const e = enlace(app, uid, campo);
    const tablaDestino = app.db.metadata.get(e.target).tableName;
    const fks = await knex.raw(`pragma foreign_key_list(\`${e.tabla}\`)`);
    const ok = fks.some((f) => f.from === e.destino && f.table === tablaDestino);
    if (!ok) malas.push(e.tabla);
  }
  if (malas.length === 0) return false;

  for (const t of malas) {
    const [{ n }] = await knex(t).count({ n: '*' });
    if (Number(n) > 0) throw new Error(`${t} tiene la FK equivocada y NO está vacía; no se borra. Revisa a mano.`);
  }

  await knex.transaction(async (trx) => {
    for (const t of malas) await trx.schema.dropTable(t);
    await trx('strapi_database_schema').del();
  });
  console.log(`  ${malas.length} tablas de enlace con la FK vieja, vacías: borradas`);
  console.log('  Instantánea del esquema vaciada. Vuelve a ejecutar --import: Strapi las recreará bien.\n');
  return true;
}

async function importar(app) {
  if (!fs.existsSync(ARCHIVO)) throw new Error(`No existe ${ARCHIVO}; ejecuta antes con --export`);
  const r = JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'));

  for (const [uid, campo] of A_ADMIN) {
    if (enlace(app, uid, campo).target !== 'admin::user') {
      throw new Error(`${clave(uid, campo)} todavía no apunta a admin::user: cambia el esquema primero`);
    }
  }
  for (const [uid, campo] of A_PERFIL) {
    if (enlace(app, uid, campo).target !== 'api::identity.profile') {
      throw new Error(`${clave(uid, campo)} todavía no apunta a profile: cambia el esquema primero`);
    }
  }

  if (await repararClaves(app)) return;

  const knex = app.db.connection;

  // 1. Cuentas del panel, con el mismo correo y la misma contraseña.
  const rolesPanel = {};
  for (const [tipo, nombre] of Object.entries(ROLES_STAFF)) {
    const rol = await app.db.query('admin::role').findOne({ where: { name: nombre } });
    if (!rol) throw new Error(`No existe el rol del panel "${nombre}": ¿arrancó el bootstrap nuevo?`);
    rolesPanel[tipo] = rol.id;
  }

  const nuevoId = {};
  for (const u of r.usuarios) {
    let admin = await app.db.query('admin::user').findOne({ where: { email: u.email.toLowerCase() } });
    if (!admin) {
      admin = await app.service('admin::user').create({
        firstname: u.perfil?.firstName ?? u.username,
        lastname: u.perfil?.lastName ?? null,
        email: u.email.toLowerCase(),
        roles: [rolesPanel[u.rol]],
        isActive: true,
      });
      console.log(`  creada la cuenta del panel ${admin.email} (${ROLES_STAFF[u.rol]})`);
    } else {
      console.log(`  ya existía la cuenta del panel ${admin.email}; se reutiliza`);
    }
    // El hash de users-permissions es bcrypt, igual que el del panel: se copia
    // sin volver a cifrar. Se anula el token de invitación que genera `create`.
    await app.db.query('admin::user').update({
      where: { id: admin.id },
      data: { password: u.password, registrationToken: null, isActive: !u.blocked, blocked: false, username: u.username },
    });
    nuevoId[u.id] = admin.id;
  }

  // 2. Vínculos a cuenta del panel, con el id nuevo.
  let escritos = 0;
  let perdidos = 0;
  await knex.transaction(async (trx) => {
    for (const [k, v] of Object.entries(r.vinculos)) {
      const [uid, campo] = [k.slice(0, k.lastIndexOf('.')), k.slice(k.lastIndexOf('.') + 1)];
      const e = enlace(app, uid, campo);
      for (const f of v.filas) {
        const destino = nuevoId[f[v.destino]];
        if (!destino) { perdidos++; continue; }
        const fila = { ...f };
        delete fila.id;
        delete fila[v.destino];
        fila[e.destino] = destino;
        await trx(e.tabla).insert(fila);
        escritos++;
      }
    }

    // 3. "Quién lo hizo", al perfil de esa persona.
    for (const [k, v] of Object.entries(r.actores)) {
      const [uid, campo] = [k.slice(0, k.lastIndexOf('.')), k.slice(k.lastIndexOf('.') + 1)];
      const e = enlace(app, uid, campo);
      for (const f of v.filas) {
        const perfil = r.perfilDe[f[v.destino]];
        if (!perfil) { perdidos++; continue; }
        const fila = { ...f };
        delete fila.id;
        delete fila[v.destino];
        fila[e.destino] = perfil;
        await trx(e.tabla).insert(fila);
        escritos++;
      }
    }
  });
  console.log(`  ${escritos} vínculos reescritos${perdidos ? `, ${perdidos} sin destino posible` : ''}`);

  // 4. El perfil de cada persona queda enlazado a SU cuenta del panel. Si otra
  //    cuenta lo tenía (p. ej. el Super Admin, para probar la agenda), la
  //    relación es oneToOne y se la quita.
  for (const u of r.usuarios) {
    if (!u.perfil) continue;
    await knex('profiles_admin_user_lnk').where({ profile_id: u.perfil.id }).del();
    await knex('profiles_admin_user_lnk').where({ user_id: nuevoId[u.id] }).del();
    await knex('profiles_admin_user_lnk').insert({ profile_id: u.perfil.id, user_id: nuevoId[u.id] });
  }

  // 5. Fuera las cuentas y los roles viejos. Las tablas de enlace de
  //    users-permissions (rol, perfil) se limpian en cascada.
  const idsViejos = r.usuarios.map((u) => u.id);
  const borrados = await app.db.query(UP_USER).deleteMany({ where: { id: { $in: idsViejos } } });
  const idsRoles = r.roles.map((x) => x.id);
  await app.db.query('plugin::users-permissions.permission').deleteMany({ where: { role: { id: { $in: idsRoles } } } });
  const rolesBorrados = await app.db.query('plugin::users-permissions.role').deleteMany({ where: { id: { $in: idsRoles } } });

  console.log(`  ${borrados.count} cuentas y ${rolesBorrados.count} roles de users-permissions eliminados`);
  console.log(`\n  Hecho. Cuando lo verifiques, borra ${ARCHIVO} (lleva hashes de contraseña).\n`);
}

(async () => {
  const modo = process.argv.includes('--import') ? 'import' : process.argv.includes('--export') ? 'export' : null;
  if (!modo) {
    console.error('Usa --export [--dry] o --import');
    process.exit(1);
  }

  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();
  await (modo === 'export' ? exportar(app, process.argv.includes('--dry')) : importar(app));
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error('la migración falló:', e.message);
  process.exit(1);
});
