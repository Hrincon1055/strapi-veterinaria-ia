'use strict';

/**
 * Enlaza una cuenta del PANEL con el perfil (ficha) de esa persona.
 *
 *   node vincular-admin.js                                   lista los enlaces
 *   node vincular-admin.js <correo-admin> <documento>        enlaza
 *   node vincular-admin.js <correo-admin> --quitar           desenlaza
 *
 * El staff trabaja en el panel: su cuenta es un `admin::user`, y a ella
 * apuntan `vet`, `responsible`, `staff`… La agenda funciona sin perfil. Lo que
 * aporta el enlace `profile.adminUser` es:
 *
 *  - el nombre completo y la ocupación en la agenda (sin él sale el
 *    nombre de la cuenta);
 *  - `appointment.bookedBy` y `signed-document-event.performedBy`, que apuntan
 *    al PERFIL de quien actúa: sin enlace, lo que esa persona agende queda con
 *    `bookedBy` vacío (ver src/validations/actor.ts).
 *
 * `demo-staff.js` ya lo deja enlazado al crear personal; esto es para cuentas
 * creadas a mano en Ajustes → Usuarios.
 *
 * Arranca su propia instancia de Strapi, así que hay que parar `npm run
 * develop` antes de ejecutarlo.
 */

const { createStrapi } = require('@strapi/strapi');

async function listar(app) {
  const perfiles = await app.documents('api::identity.profile').findMany({
    filters: { adminUser: { id: { $notNull: true } } },
    populate: ['adminUser'],
    pagination: { limit: -1 },
  });

  console.log('\nEnlaces cuenta del panel <-> perfil\n');
  if (perfiles.length === 0) {
    console.log('  (ninguno)');
  } else {
    for (const p of perfiles) {
      console.log(
        `  ${p.adminUser.email.padEnd(34)} -> ${`${p.firstName} ${p.lastName}`.padEnd(20)}` +
          ` doc ${p.documentNumber}${p.occupation ? `  (${p.occupation})` : ''}`
      );
    }
  }

  const admins = await app.db.query('admin::user').findMany({});
  const sinEnlace = admins.filter((a) => !perfiles.some((p) => p.adminUser.id === a.id));
  if (sinEnlace.length > 0) {
    console.log('\nCuentas del panel sin perfil (lo que agenden queda sin bookedBy):');
    sinEnlace.forEach((a) => console.log(`  ${a.email}`));
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

    const admin = await app.db.query('admin::user').findOne({ where: { email: correo.toLowerCase() } });
    if (!admin) {
      console.error(`No existe la cuenta del panel ${correo}`);
      process.exitCode = 1;
      return;
    }

    // Una cuenta del panel solo puede estar en un perfil: la relación es 1-1.
    // Se limpia siempre antes de asignar.
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
    });
    if (!perfil) {
      console.error(`No hay perfil con documento ${documento}`);
      process.exitCode = 1;
      return;
    }

    await app.documents('api::identity.profile').update({
      documentId: perfil.documentId,
      data: { adminUser: admin.id },
    });

    console.log(`\n  ${admin.email}  ->  ${perfil.firstName} ${perfil.lastName}\n`);
  } finally {
    await app.destroy();
  }

  process.exit(process.exitCode ?? 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
