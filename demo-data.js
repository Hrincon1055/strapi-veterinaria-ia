'use strict';

/**
 * Datos de muestra para ver el modelo funcionando: 3 clientes con sus
 * mascotas, el personal (cuentas del panel con horario), la historia clínica
 * de Kira, la ficha de la clínica y las citas de la semana en curso.
 *
 *   node demo-data.js           crea los datos (idempotente, se puede repetir)
 *   node demo-data.js --reset   los borra, y además los restos sin mascota que
 *                               hayan dejado ejecuciones anteriores
 *
 * Dos de los clientes tienen cuenta de portal y uno no: es el cliente de
 * mostrador, que existe como profile + customer sin usuario. Esa diferencia es
 * justamente lo que permite la cadena user -> profile -> customer -> pets.
 *
 * Los datos quedan en la base de desarrollo para poder mirarlos en el panel.
 */

const { createStrapi } = require('@strapi/strapi');
const { crearHistoria, borrarHistoria } = require('./demo-clinica');
const { crearClinica, borrarClinica } = require('./demo-clinic');
const { crearHorarios, borrarHorarios } = require('./demo-horarios');
const { crearAgenda, borrarAgenda } = require('./demo-agenda');

/**
 * Registros que no pueden existir sin mascota (la relación es obligatoria).
 * Si aparece uno sin ella, es resto de una mascota ya borrada: por ejemplo,
 * las citas de la agenda cuando se borraban las mascotas pero no las citas.
 */
const CUELGAN_DE_LA_MASCOTA = [
  'api::clinical.pet-vaccination',
  'api::clinical.allergy',
  'api::clinical.consultation',
  'api::scheduling.appointment',
];

async function borrarHuerfanos(app) {
  let n = 0;
  for (const uid of CUELGAN_DE_LA_MASCOTA) {
    // `archivedAt` en el filtro para que archived.ts no esconda los archivados.
    const huerfanos = await app.documents(uid).findMany({
      filters: {
        pet: { id: { $null: true } },
        ...(uid === 'api::clinical.consultation' ? { $or: [{ archivedAt: { $null: true } }, { archivedAt: { $notNull: true } }] } : {}),
      },
      fields: ['documentId'],
      pagination: { limit: -1 },
    });
    for (const h of huerfanos) {
      await app.documents(uid).delete({ documentId: h.documentId });
      n++;
    }
  }
  return n;
}

const PASSWORD = 'Demo12345';

const CLIENTES = [
  {
    perfil: {
      firstName: 'María',
      lastName: 'Restrepo',
      documentType: 'cc',
      documentNumber: '1017254398',
      gender: 'female',
      birthDate: '1988-04-17',
      occupation: 'Diseñadora gráfica',
    },
    direccion: {
      addressType: 'home',
      addressLine: 'Calle 10 #43-12, apto 502',
      city: 'Medellín',
      region: 'Antioquia',
      postalCode: '050021',
      isPrimary: true,
    },
    contactos: [
      { contactType: 'phone', value: '+573014785512', isPrimary: true },
      { contactType: 'email', value: 'maria.restrepo@example.com', isPrimary: true },
    ],
    consents: { marketing: true, sms: true, email: true, dataProcessing: true },
    referralSource: 'google',
    usuario: { username: 'maria.restrepo', email: 'maria.restrepo@example.com' },
    mascotas: [
      {
        name: 'Kira',
        especie: 'Perro',
        raza: 'Labrador Retriever',
        sex: 'female',
        birthDate: '2021-03-14',
        weightKg: 28.5,
        color: 'Dorado',
        sterilizationState: 'sterilized',
        sterilizedOn: '2022-06-10',
        microchip: '982000123456789',
      },
      {
        name: 'Milo',
        especie: 'Gato',
        raza: 'Criollo',
        sex: 'male',
        birthDate: '2023-07-02',
        weightKg: 4.2,
        color: 'Atigrado gris',
        sterilizationState: 'intact',
      },
    ],
  },
  {
    perfil: {
      firstName: 'Carlos',
      lastName: 'Betancur',
      documentType: 'cc',
      documentNumber: '71654890',
      gender: 'male',
      birthDate: '1979-11-30',
      occupation: 'Ingeniero civil',
    },
    direccion: {
      addressType: 'home',
      addressLine: 'Carrera 43A #27 Sur-15',
      city: 'Envigado',
      region: 'Antioquia',
      postalCode: '055422',
      isPrimary: true,
    },
    contactos: [
      { contactType: 'phone', value: '+573155501122', isPrimary: true },
      { contactType: 'email', value: 'carlos.betancur@example.com', isPrimary: true },
    ],
    consents: { marketing: true, sms: false, email: true, dataProcessing: true },
    referralSource: 'friend',
    usuario: { username: 'carlos.betancur', email: 'carlos.betancur@example.com' },
    mascotas: [
      {
        name: 'Rocco',
        especie: 'Perro',
        raza: 'Bulldog Francés',
        sex: 'male',
        birthDate: '2019-11-08',
        weightKg: 12.8,
        color: 'Atigrado',
        sterilizationState: 'sterilized',
        sterilizedOn: '2021-02-19',
        microchip: '982000987654321',
      },
    ],
  },
  {
    perfil: {
      firstName: 'Luz',
      lastName: 'Ramírez',
      documentType: 'ce',
      documentNumber: '402219',
      gender: 'female',
      birthDate: '1965-02-08',
      occupation: 'Pensionada',
    },
    direccion: {
      addressType: 'home',
      addressLine: 'Calle 68 Sur #35-40',
      city: 'Sabaneta',
      region: 'Antioquia',
      isPrimary: true,
    },
    contactos: [{ contactType: 'phone', value: '+573201144788', isPrimary: true }],
    // Sin consentimiento de marketing: no debe entrar en las campañas.
    consents: { marketing: false, sms: false, email: false, dataProcessing: true },
    referralSource: 'walk_in',
    // Cliente de mostrador: sin cuenta de portal.
    usuario: null,
    mascotas: [
      {
        name: 'Nube',
        especie: 'Gato',
        raza: 'Persa',
        sex: 'female',
        birthDate: '2022-01-20',
        weightKg: 3.9,
        color: 'Blanco',
        sterilizationState: 'sterilized',
        sterilizedOn: '2023-03-05',
      },
      {
        name: 'Simón',
        especie: 'Gato',
        raza: 'Criollo',
        sex: 'male',
        birthDate: '2020-05-11',
        weightKg: 5.1,
        color: 'Negro',
        sterilizationState: 'unknown',
      },
    ],
  },
];

/** Razas que hacen falta, por especie. */
const RAZAS = {
  Perro: ['Labrador Retriever', 'Bulldog Francés'],
  Gato: ['Criollo', 'Persa'],
};

async function crear(app) {
  const d = (uid) => app.documents(uid);

  // --- razas -------------------------------------------------------------
  const especies = {};
  const razas = {};

  for (const [nombreEspecie, nombresRaza] of Object.entries(RAZAS)) {
    const especie = await d('api::pet.species').findFirst({ filters: { name: nombreEspecie } });
    if (!especie) throw new Error(`Falta la especie "${nombreEspecie}" (¿corrió el seed?)`);
    especies[nombreEspecie] = especie;

    for (const nombreRaza of nombresRaza) {
      let raza = await d('api::pet.breed').findFirst({
        filters: { name: nombreRaza, species: { documentId: especie.documentId } },
      });
      if (!raza) {
        raza = await d('api::pet.breed').create({
          data: { name: nombreRaza, species: especie.documentId, isActive: true },
        });
      }
      razas[`${nombreEspecie}/${nombreRaza}`] = raza;
    }
  }

  const rolCliente = await app
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'client' } });

  const resumen = [];

  for (const c of CLIENTES) {
    // --- profile ---------------------------------------------------------
    let perfil = await d('api::identity.profile').findFirst({
      filters: { documentNumber: c.perfil.documentNumber },
    });

    if (!perfil) {
      perfil = await d('api::identity.profile').create({
        data: { ...c.perfil, addresses: [c.direccion] },
      });
    }

    // --- contactos -------------------------------------------------------
    for (const contacto of c.contactos) {
      const existe = await d('api::shared.contact').findFirst({
        filters: { profile: { documentId: perfil.documentId }, value: contacto.value },
      });
      if (!existe) {
        await d('api::shared.contact').create({
          data: { ...contacto, profile: perfil.documentId },
        });
      }
    }

    // --- customer --------------------------------------------------------
    let cliente = await d('api::customer.customer').findFirst({
      filters: { profile: { documentId: perfil.documentId } },
    });

    if (!cliente) {
      cliente = await d('api::customer.customer').create({
        data: {
          profile: perfil.documentId,
          consents: c.consents,
          referralSource: c.referralSource,
        },
      });
    }

    // --- usuario del portal (solo si el cliente lo tiene) ------------------
    let usuario = null;
    if (c.usuario) {
      usuario = await app
        .query('plugin::users-permissions.user')
        .findOne({ where: { username: c.usuario.username } });

      if (!usuario) {
        usuario = await app.plugin('users-permissions').service('user').add({
          username: c.usuario.username,
          email: c.usuario.email,
          password: PASSWORD,
          provider: 'local',
          confirmed: true,
          blocked: false,
          role: rolCliente.id,
          profile: perfil.documentId,
        });
      }
    }

    // --- mascotas --------------------------------------------------------
    const mascotas = [];
    for (const m of c.mascotas) {
      const { especie, raza, ...campos } = m;
      let mascota = await d('api::pet.pet').findFirst({
        filters: { name: m.name, owner: { documentId: cliente.documentId } },
      });
      if (!mascota) {
        mascota = await d('api::pet.pet').create({
          data: {
            ...campos,
            owner: cliente.documentId,
            species: especies[especie].documentId,
            breed: razas[`${especie}/${raza}`].documentId,
          },
        });
      }
      mascotas.push({ ...mascota, especie, raza });
    }

    // `create` no devuelve los componentes poblados: se relee para el resumen.
    const clienteCompleto = await d('api::customer.customer').findOne({
      documentId: cliente.documentId,
      populate: ['consents'],
    });

    resumen.push({ perfil, cliente: clienteCompleto, usuario, mascotas });
  }

  return resumen;
}

/**
 * Documentos y cuentas que crea `demo-flujo.js` al recorrer el alta del
 * portal, para que `--reset` deje el sistema como estaba y la demostración se
 * pueda repetir.
 */
const DEL_FLUJO = {
  documentos: ['1099887766'],
  usuarios: ['luz.ramirez', 'ana.nueva'],
};

async function borrar(app) {
  const d = (uid) => app.documents(uid);

  // Primero lo que cuelga de las mascotas que se borran abajo: la agenda de
  // la semana y la historia clínica. Si las mascotas se borraran antes, esas
  // citas y consultas quedarían huérfanas y ya no se podrían encontrar.
  let n = await borrarAgenda(app);
  n += await borrarHistoria(app);
  n += await borrarClinica(app);
  n += await borrarHorarios(app);
  const documentos = [...CLIENTES.map((c) => c.perfil.documentNumber), ...DEL_FLUJO.documentos];

  for (const documentNumber of documentos) {
    const perfil = await d('api::identity.profile').findFirst({ filters: { documentNumber } });
    if (!perfil) continue;

    const cliente = await d('api::customer.customer').findFirst({
      filters: { profile: { documentId: perfil.documentId } },
    });

    if (cliente) {
      for (const mascota of await d('api::pet.pet').findMany({
        filters: { owner: { documentId: cliente.documentId } },
      })) {
        await d('api::pet.pet').delete({ documentId: mascota.documentId });
        n++;
      }
      await d('api::customer.customer').delete({ documentId: cliente.documentId });
      n++;
    }

    for (const contacto of await d('api::shared.contact').findMany({
      filters: { profile: { documentId: perfil.documentId } },
    })) {
      // Los códigos de verificación apuntan al contacto: si se borra el
      // contacto sin ellos, quedan huérfanos en la tabla.
      for (const codigo of await d('api::shared.verification-code').findMany({
        filters: { contact: { documentId: contacto.documentId } },
      })) {
        await d('api::shared.verification-code').delete({ documentId: codigo.documentId });
        n++;
      }
      await d('api::shared.contact').delete({ documentId: contacto.documentId });
      n++;
    }

    await d('api::identity.profile').delete({ documentId: perfil.documentId });
    n++;
  }

  const usuarios = [
    ...CLIENTES.filter((c) => c.usuario).map((c) => c.usuario.username),
    ...DEL_FLUJO.usuarios,
  ];
  for (const username of usuarios) {
    const r = await app.query('plugin::users-permissions.user').deleteMany({ where: { username } });
    n += r?.count ?? 0;
  }

  return n;
}

(async () => {
  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();

  if (process.argv.includes('--reset')) {
    const n = await borrar(app);
    // Al final: lo que quedó sin mascota es resto de ejecuciones anteriores.
    const huerfanos = await borrarHuerfanos(app);
    console.log(`\n${n} registros de muestra eliminados${huerfanos ? `, y ${huerfanos} huérfanos sin mascota` : ''}\n`);
    await app.destroy();
    process.exit(0);
  }

  // El orden importa: el personal (con sus horarios) antes que la historia y
  // la agenda, porque sus citas apuntan a esas cuentas y las de muestra salen
  // agendadas por recepción.
  const resumen = await crear(app);
  const horarios = await crearHorarios(app);
  const historia = await crearHistoria(app);
  const clinica = await crearClinica(app);
  await crearAgenda(app);

  console.log('\n================  CLIENTES DE MUESTRA  ================\n');
  for (const { perfil, cliente, usuario, mascotas } of resumen) {
    const acceso = usuario ? `portal: ${usuario.username} / ${PASSWORD}` : 'sin cuenta (mostrador)';
    console.log(`${perfil.firstName} ${perfil.lastName}  (${perfil.documentType.toUpperCase()} ${perfil.documentNumber})`);
    console.log(`   ${acceso}`);
    console.log(`   marketing: ${cliente.consents?.marketing ? 'sí' : 'no'}`);
    for (const m of mascotas) {
      console.log(`   - ${m.name.padEnd(7)} ${m.especie}/${m.raza}, ${m.sex}, ${m.weightKg} kg`);
    }
    console.log('');
  }

  for (const h of horarios) console.log(`Horario: ${h.email.padEnd(32)} ${h.consultorio.padEnd(18)} ${h.slot} min · ${h.dias} días/semana`);
  console.log(`Clínica: ${clinica.nombre}${clinica.nit ? ' · NIT ' + clinica.nit : ''}`);
  console.log(`Historia clínica de ${historia.mascota}: ${historia.visitas} visitas nuevas`);
  console.log(`Personal: entra al panel (/admin) con su correo / Clinica12345 — p. ej. ${historia.vet}`);
  console.log(`\nVer la historia:  node demo-historia.js ${historia.mascota}\n`);

  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error('error creando los datos de muestra:', e);
  process.exit(1);
});
