'use strict';

/**
 * Alta y baja de personal para los scripts de demo y de prueba.
 *
 * El staff trabaja en el panel: cada persona es un `admin::user` con uno de
 * los roles de `src/bootstrap/admin-roles.ts` (Recepción, Veterinario,
 * Administrador de clínica), y su ficha (`profile`) se une a esa cuenta por
 * `profile.adminUser`. No tiene cuenta de users-permissions: esa es solo del
 * rol Cliente.
 *
 * No se ejecuta suelto; lo usan demo-clinica.js, demo-horarios.js y
 * smoke-validations.js.
 */

/**
 * Devuelve la cuenta del panel con ese correo, creándola si falta, y deja su
 * perfil enlazado. Idempotente.
 *
 *   { email, rol: 'Veterinario', password, perfil: { documentNumber, firstName, … } }
 */
async function cuentaDelPanel(app, { email, rol, password, perfil }) {
  const correo = email.toLowerCase();
  let cuenta = await app.db.query('admin::user').findOne({ where: { email: correo } });

  if (!cuenta) {
    const rolPanel = await app.db.query('admin::role').findOne({ where: { name: rol } });
    if (!rolPanel) throw new Error(`No existe el rol del panel "${rol}" (lo crea src/bootstrap/admin-roles.ts)`);

    // `create` cifra la contraseña; el token de invitación se anula porque la
    // cuenta ya nace activa y con contraseña.
    cuenta = await app.service('admin::user').create({
      firstname: perfil?.firstName ?? correo,
      lastname: perfil?.lastName ?? null,
      email: correo,
      password,
      roles: [rolPanel.id],
      isActive: true,
    });
    await app.db.query('admin::user').update({ where: { id: cuenta.id }, data: { registrationToken: null } });
  }

  if (perfil) {
    const d = app.documents('api::identity.profile');
    let ficha = await d.findFirst({ filters: { documentNumber: perfil.documentNumber } });
    if (!ficha) ficha = await d.create({ data: perfil });
    // El registro profesional se completa si falta (perfiles creados antes de
    // que existiera la fórmula médica), sin pisar uno puesto a mano.
    const registro =
      perfil.professionalLicense && !ficha.professionalLicense
        ? { professionalLicense: perfil.professionalLicense, licenseIssuer: perfil.licenseIssuer ?? null }
        : {};
    await d.update({ documentId: ficha.documentId, data: { adminUser: cuenta.id, ...registro } });
  }

  return cuenta;
}

/** Borra la cuenta del panel y, si se indica, su perfil. Devuelve cuántos borró. */
async function borrarCuentaDelPanel(app, { email, documentNumber }) {
  let n = 0;
  const cuenta = await app.db.query('admin::user').findOne({ where: { email: email.toLowerCase() } });
  if (cuenta) {
    await app.service('admin::user').deleteById(cuenta.id);
    n++;
  }
  if (documentNumber) {
    const d = app.documents('api::identity.profile');
    for (const r of await d.findMany({ filters: { documentNumber } })) {
      await d.delete({ documentId: r.documentId });
      n++;
    }
  }
  return n;
}

/**
 * documentId del perfil enlazado a la cuenta del panel con ese correo, o null.
 *
 * Los scripts crean citas sin sesión, así que `src/validations/actor.ts` no
 * rellena `bookedBy`: se lo pasan ellos con esto.
 */
async function perfilDeCuenta(app, email) {
  const perfil = await app.documents('api::identity.profile').findFirst({
    filters: { adminUser: { email: email.toLowerCase() } },
    fields: ['documentId'],
  });
  return perfil?.documentId ?? null;
}

/** Quien agenda en la clínica: las citas de muestra salen a su nombre. */
const RECEPCION = 'andres.mejia@veterinaria.test';

module.exports = { cuentaDelPanel, borrarCuentaDelPanel, perfilDeCuenta, RECEPCION };
