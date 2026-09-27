'use strict';

/**
 * Horarios de atención de muestra.
 *
 * Lo usa `demo-data.js`; no se ejecuta suelto.
 *
 * Tres perfiles distintos a propósito, para que se vea que el sistema no está
 * atado a "médico veterinario":
 *
 *   Laura (veterinaria)  L-V 07:00-17:00, Consultorio 1, 45 min por paciente
 *   Andrés (peluquero)   L-S en dos tramos,  Sala de estética, 90 min
 *   Sofía (cirujana)     Mar y Jue mañana,   Quirófano, 120 min
 *
 * Y una ausencia real: Laura de vacaciones una semana, para comprobar que
 * esos días desaparecen de los huecos.
 */

const PERSONAL = [
  {
    username: 'laura.gomez', // ya existe (demo-clinica.js)
    horario: {
      consultorio: 'Consultorio 1',
      slotMinutes: 45,
      validFrom: '2026-01-01',
      turnos: [
        ['monday', '07:00:00.000', '17:00:00.000'],
        ['tuesday', '07:00:00.000', '17:00:00.000'],
        ['wednesday', '07:00:00.000', '17:00:00.000'],
        ['thursday', '07:00:00.000', '17:00:00.000'],
        ['friday', '07:00:00.000', '17:00:00.000'],
      ],
    },
    ausencia: {
      exceptionKind: 'absence',
      reason: 'vacation',
      fromDate: '2026-10-05',
      toDate: '2026-10-09',
      isAllDay: true,
      notes: 'Vacaciones',
    },
  },
  {
    crear: {
      username: 'andres.mejia',
      email: 'andres.mejia@veterinaria.test',
      rol: 'receptionist',
      perfil: {
        firstName: 'Andrés', lastName: 'Mejía', documentType: 'cc',
        documentNumber: '1038456712', occupation: 'Peluquero canino', gender: 'male',
      },
    },
    horario: {
      consultorio: 'Sala de estética',
      slotMinutes: 90,
      validFrom: '2026-01-01',
      // Dos tramos con pausa de almuerzo: el generador respeta el hueco.
      turnos: [
        ['monday', '08:00:00.000', '12:00:00.000'],
        ['monday', '14:00:00.000', '18:00:00.000'],
        ['tuesday', '08:00:00.000', '12:00:00.000'],
        ['tuesday', '14:00:00.000', '18:00:00.000'],
        ['wednesday', '08:00:00.000', '12:00:00.000'],
        ['thursday', '08:00:00.000', '12:00:00.000'],
        ['friday', '08:00:00.000', '12:00:00.000'],
        ['saturday', '08:00:00.000', '14:00:00.000'],
      ],
    },
  },
  {
    crear: {
      username: 'sofia.arango',
      email: 'sofia.arango@veterinaria.test',
      rol: 'veterinarian',
      perfil: {
        firstName: 'Sofía', lastName: 'Arango', documentType: 'cc',
        documentNumber: '43991205', occupation: 'Cirujana veterinaria', gender: 'female',
      },
    },
    horario: {
      consultorio: 'Quirófano',
      slotMinutes: 120,
      validFrom: '2026-01-01',
      turnos: [
        ['tuesday', '07:00:00.000', '13:00:00.000'],
        ['thursday', '07:00:00.000', '13:00:00.000'],
      ],
    },
  },
];

const PASSWORD = 'Clinica12345';

async function crearHorarios(app) {
  const d = (uid) => app.documents(uid);
  const resumen = [];

  for (const p of PERSONAL) {
    // --- la persona ---
    const username = p.crear?.username ?? p.username;
    let usuario = await app.query('plugin::users-permissions.user').findOne({ where: { username } });

    if (!usuario && p.crear) {
      let perfil = await d('api::identity.profile').findFirst({
        filters: { documentNumber: p.crear.perfil.documentNumber },
      });
      if (!perfil) perfil = await d('api::identity.profile').create({ data: p.crear.perfil });

      const rol = await app.query('plugin::users-permissions.role').findOne({ where: { type: p.crear.rol } });
      usuario = await app.plugin('users-permissions').service('user').add({
        username: p.crear.username,
        email: p.crear.email,
        password: PASSWORD,
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: rol.id,
        profile: perfil.documentId,
      });
    }
    if (!usuario) continue;

    // --- su horario ---
    const yaTiene = await d('api::scheduling.staff-schedule').findFirst({
      filters: { staff: { documentId: usuario.documentId } },
    });

    if (!yaTiene) {
      const sala = await d('api::scheduling.clinic-room').findFirst({
        filters: { name: p.horario.consultorio },
      });

      await d('api::scheduling.staff-schedule').create({
        data: {
          staff: usuario.documentId,
          room: sala?.documentId,
          slotMinutes: p.horario.slotMinutes,
          validFrom: p.horario.validFrom,
          isActive: true,
          shifts: p.horario.turnos.map(([dayOfWeek, startsAt, endsAt]) => ({
            dayOfWeek,
            startsAt,
            endsAt,
          })),
        },
      });
    }

    // --- su ausencia, si la tiene ---
    if (p.ausencia) {
      const existe = await d('api::scheduling.schedule-exception').findFirst({
        filters: { staff: { documentId: usuario.documentId }, fromDate: p.ausencia.fromDate },
      });
      if (!existe) {
        await d('api::scheduling.schedule-exception').create({
          data: { staff: usuario.documentId, ...p.ausencia },
        });
      }
    }

    resumen.push({
      username,
      consultorio: p.horario.consultorio,
      slot: p.horario.slotMinutes,
      dias: [...new Set(p.horario.turnos.map((t) => t[0]))].length,
    });
  }

  return resumen;
}

async function borrarHorarios(app) {
  const d = (uid) => app.documents(uid);
  let n = 0;

  for (const uid of ['api::scheduling.schedule-exception', 'api::scheduling.staff-schedule']) {
    for (const r of await d(uid).findMany({})) {
      await d(uid).delete({ documentId: r.documentId });
      n++;
    }
  }

  for (const p of PERSONAL) {
    if (!p.crear) continue;
    const borrado = await app
      .query('plugin::users-permissions.user')
      .deleteMany({ where: { username: p.crear.username } });
    n += borrado?.count ?? 0;

    for (const r of await d('api::identity.profile').findMany({
      filters: { documentNumber: p.crear.perfil.documentNumber },
    })) {
      await d('api::identity.profile').delete({ documentId: r.documentId });
      n++;
    }
  }

  return n;
}

module.exports = { crearHorarios, borrarHorarios };
