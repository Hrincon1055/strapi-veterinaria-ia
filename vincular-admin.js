'use strict';

/**
 * Enlaza una cuenta del PANEL con un perfil de personal.
 *
 *   node vincular-admin.js                                   lista los enlaces
 *   node vincular-admin.js <correo-admin> <documento>        enlaza
 *   node vincular-admin.js <correo-admin> --quitar           desenlaza
 *
 * Por qué hace falta: Strapi tiene dos tablas de personas que no se conocen
 * entre sí. Quien entra al panel es un `admin::user`; quien atiende una cita o
 * firma una consulta es un `plugin::users-permissions.user`. El perfil es lo
 * único que puede unirlos, y por eso lleva las dos relaciones: `user` (cuenta
 * de la app) y `adminUser` (cuenta del panel).
 *
 * Sin este enlace, la página de Agenda no sabe qué profesional la está
 * mirando: `/veterinaria-agenda/me` responde `enlazado: false` y la vista
 * personal no puede mostrarse.
 *
 * Arranca su propia instancia de Strapi, así que hay que parar `npm run
 * develop` antes de ejecutarlo.
 */

const { createStrapi } = require('@strapi/strapi');

async function listar(app) {
  const perfiles = await app.documents('api::identity.profile').findMany({
    populate: ['adminUser', 'user'],
    pagination: { limit: -1 },
  });

  const enlazados = perfiles.filter((p) => p.adminUser);

  console.log('\nEnlaces panel <-> personal\n');
  if (enlazados.length === 0) {
    console.log('  (ninguno)');
  } else {
    for (const p of enlazados) {
      console.log(
        `  ${p.adminUser.email.padEnd(34)} -> ${`${p.firstName} ${p.lastName}`.padEnd(20)}` +
          ` doc ${String(p.documentNumber).padEnd(12)} ${p.user ? `app: ${p.user.username}` : 'SIN cuenta de app'}`
      );
    }
  }

  const admins = await app.db.query('admin::user').findMany({});
  const sinEnlace = admins.filter((a) => !enlazados.some((p) => p.adminUser.id === a.id));
  if (sinEnlace.length > 0) {
    console.log('\nCuentas de panel sin perfil enlazado (no verán agenda personal):');
    sinEnlace.forEach((a) => console.log(`  ${a.email}`));
  }

  console.log('\nPerfiles de personal disponibles (tienen cuenta de app):');
  for (const p of perfiles.filter((x) => x.user)) {
    console.log(`  doc ${String(p.documentNumber).padEnd(12)} ${p.firstName} ${p.lastName}  (${p.user.username})`);
  }
  console.log('');
}

(async () => {
  const [correo, documento] = process.argv.slice(2);

  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();

  try {
    if (!correo) {
      await listar(app);
      return;
    }

    const admin = await app.db.query('admin::user').findOne({ where: { email: correo } });
    if (!admin) {
      console.error(`No existe la cuenta de panel ${correo}`);
      process.exitCode = 1;
      return;
    }

    // Una cuenta de panel solo puede estar en un perfil: la relación es 1-1 y
    // dejar dos apuntando al mismo administrador daría una agenda "propia"
    // ambigua. Se limpia siempre antes de asignar.
    const previos = await app.documents('api::identity.profile').findMany({
      filters: { adminUser: { id: admin.id } },
    });
    for (const p of previos) {
      await app.documents('api::identity.profile').update({
        documentId: p.documentId,
        data: { adminUser: null },
      });
      console.log(`desenlazado de ${p.firstName} ${p.lastName}`);
    }

    if (!documento || documento === '--quitar') {
      console.log(previos.length === 0 ? 'No había enlace que quitar.' : 'Enlace eliminado.');
      return;
    }

    const perfil = await app.documents('api::identity.profile').findFirst({
      filters: { documentNumber: String(documento) },
      populate: ['user'],
    });
    if (!perfil) {
      console.error(`No hay perfil con documento ${documento}`);
      process.exitCode = 1;
      return;
    }
    if (!perfil.user) {
      console.error(
        `${perfil.firstName} ${perfil.lastName} no tiene cuenta de app (profile.user).\n` +
          'Sin ella no hay citas que mostrar: las citas apuntan al usuario, no al perfil.'
      );
      process.exitCode = 1;
      return;
    }

    await app.documents('api::identity.profile').update({
      documentId: perfil.documentId,
      data: { adminUser: admin.id },
    });

    console.log(`\n  ${admin.email}  ->  ${perfil.firstName} ${perfil.lastName}  (app: ${perfil.user.username})\n`);
    console.log('Ya puedes abrir Agenda en el panel y ver la vista personal.\n');
  } finally {
    await app.destroy();
  }

  process.exit(process.exitCode ?? 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
