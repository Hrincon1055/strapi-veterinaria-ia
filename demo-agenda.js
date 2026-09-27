'use strict';

/**
 * Citas de muestra para ver la página de Agenda con contenido.
 *
 *   node demo-agenda.js            crea las citas de la semana en curso
 *   node demo-agenda.js --reset    las borra
 *
 * Las horas NO se inventan: se piden a `api::scheduling.availability`, que es
 * el mismo servicio que alimenta la rejilla. Así las citas caen siempre en un
 * hueco real del horario de cada profesional, respetan su duración por
 * paciente (45, 90 o 120 minutos) y el script sigue funcionando aunque se
 * cambien los horarios.
 *
 * Idempotente: no duplica: antes de crear comprueba que el profesional no
 * tenga ya una cita a esa hora.
 *
 * Arranca su propia instancia de Strapi, así que hay que parar `npm run
 * develop` antes de ejecutarlo.
 */

const { createStrapi } = require('@strapi/strapi');

const MARCA = '[demo]';

/** Lunes de la semana que contiene esa fecha. */
function lunesDe(fecha) {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  const dia = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dia === 0 ? 6 : dia - 1));
  return d.toISOString().slice(0, 10);
}

const sumarDias = (fecha, n) => {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Qué se le agenda a quién. Se reparte entre los tres profesionales para que
 * la vista general tenga varias columnas con contenido y la personal no salga
 * vacía sea cual sea la cuenta enlazada.
 */
const CITAS = [
  { staff: 'laura.gomez', mascota: 'Kira', titulo: 'Control anual', dia: 0, hueco: 2, estado: 'confirmed' },
  { staff: 'laura.gomez', mascota: 'Milo', titulo: 'Vacunación refuerzo', dia: 1, hueco: 0, estado: 'scheduled' },
  { staff: 'laura.gomez', mascota: 'Nube', titulo: 'Revisión por vómito', dia: 2, hueco: 4, estado: 'scheduled' },
  { staff: 'laura.gomez', mascota: 'Rocco', titulo: 'Retiro de puntos', dia: 3, hueco: 1, estado: 'confirmed' },
  { staff: 'andres.mejia', mascota: 'Simón', titulo: 'Baño y corte', dia: 0, hueco: 1, estado: 'confirmed' },
  { staff: 'andres.mejia', mascota: 'Kira', titulo: 'Corte de uñas', dia: 2, hueco: 0, estado: 'scheduled' },
  { staff: 'sofia.arango', mascota: 'Rocco', titulo: 'Esterilización', dia: 1, hueco: 0, estado: 'scheduled' },
];

async function crear(app) {
  const d = (uid) => app.documents(uid);
  const disponibilidad = app.service('api::scheduling.availability');

  const hoy = new Date().toISOString().slice(0, 10);
  const lunes = lunesDe(hoy);
  const domingo = sumarDias(lunes, 6);

  console.log(`\nSemana ${lunes} a ${domingo}\n`);

  let creadas = 0;
  let saltadas = 0;

  for (const c of CITAS) {
    const usuario = await app
      .query('plugin::users-permissions.user')
      .findOne({ where: { username: c.staff } });
    const mascota = await d('api::pet.pet').findFirst({ filters: { name: c.mascota } });

    if (!usuario || !mascota) {
      console.log(`  omitida: falta ${!usuario ? c.staff : c.mascota} (¿corriste demo-data.js?)`);
      saltadas++;
      continue;
    }

    const libres = await disponibilidad.huecos(usuario.documentId, lunes, domingo);
    const dia = (libres.dias ?? [])[c.dia];
    const hueco = dia?.huecos?.[c.hueco];

    if (!hueco) {
      console.log(`  omitida: ${c.staff} no tiene hueco libre ${c.hueco} el día ${c.dia}`);
      saltadas++;
      continue;
    }

    // El generador devuelve la hora local del horario, sin zona; la cita se
    // guarda en UTC como el resto del sistema.
    const startAt = `${hueco.startAt}Z`;
    const endAt = `${hueco.endAt}Z`;

    const yaHay = await d('api::scheduling.appointment').findFirst({
      filters: { responsible: { documentId: usuario.documentId }, startAt },
    });
    if (yaHay) {
      saltadas++;
      continue;
    }

    await d('api::scheduling.appointment').create({
      data: {
        pet: mascota.documentId,
        responsible: usuario.documentId,
        room: hueco.room ?? undefined,
        startAt,
        endAt,
        state: c.estado,
        source: 'front_desk',
        title: `${c.titulo} ${MARCA}`,
      },
    });

    console.log(
      `  ${startAt.slice(0, 16).replace('T', ' ')}  ${c.staff.padEnd(14)} ${c.mascota.padEnd(7)} ${c.titulo}`
    );
    creadas++;
  }

  console.log(`\n${creadas} cita(s) creada(s)${saltadas ? `, ${saltadas} omitida(s)` : ''}.`);
  console.log('Abre el panel -> Agenda para verlas.\n');
}

async function borrar(app) {
  const d = (uid) => app.documents(uid);
  let n = 0;

  for (const cita of await d('api::scheduling.appointment').findMany({
    filters: { title: { $contains: MARCA } },
    populate: ['consultation'],
    pagination: { limit: -1 },
  })) {
    // La consulta que se abrió desde la cita también es de muestra.
    if (cita.consultation) {
      await d('api::clinical.consultation').delete({ documentId: cita.consultation.documentId });
      n++;
    }
    await d('api::scheduling.appointment').delete({ documentId: cita.documentId });
    n++;
  }

  console.log(`\n${n} registro(s) de muestra eliminado(s).\n`);
}

(async () => {
  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();
  try {
    if (process.argv.includes('--reset')) await borrar(app);
    else await crear(app);
  } finally {
    await app.destroy();
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
