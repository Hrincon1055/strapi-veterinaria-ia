'use strict';

/**
 * Lógica de la agenda semanal.
 *
 * No reimplementa el cálculo de huecos: lo pide a
 * `api::scheduling.availability`, que ya cruza horario, excepciones y citas.
 * Aquí solo se añade lo que la pantalla necesita y el cálculo no da: quién es
 * cada cita y en qué estado está.
 */

const BLOQUEAN = ['scheduled', 'confirmed', 'arrived', 'in_progress'];

/** Lunes de la semana que contiene esa fecha (ISO: la semana empieza en lunes). */
function lunesDe(fecha) {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  const dia = d.getUTCDay(); // 0 domingo
  d.setUTCDate(d.getUTCDate() - (dia === 0 ? 6 : dia - 1));
  return d.toISOString().slice(0, 10);
}

const sumarDias = (fecha, n) => {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

module.exports = ({ strapi }) => ({
  lunesDe,

  /**
   * Quién es el administrador que está mirando.
   *
   * El puente es `profile.adminUser`: quien entra al panel es un `admin::user`
   * y las citas apuntan a un `users-permissions.user`. El perfil une ambos.
   */
  async quienSoy(adminUserId) {
    const perfil = await strapi.documents('api::identity.profile').findFirst({
      filters: { adminUser: { id: adminUserId } },
      populate: ['user'],
    });

    return {
      adminUserId,
      profileDocumentId: perfil?.documentId ?? null,
      nombre: perfil ? `${perfil.firstName} ${perfil.lastName}` : null,
      staffDocumentId: perfil?.user?.documentId ?? null,
      // Sin enlace no hay agenda personal posible: la interfaz debe decirlo
      // en vez de mostrar un calendario vacío que parece un error.
      enlazado: Boolean(perfil?.user?.documentId),
    };
  },

  /** Personal con horario activo, para el selector. */
  async personal() {
    const horarios = await strapi.documents('api::scheduling.staff-schedule').findMany({
      filters: { isActive: true },
      populate: { staff: true, room: true },
    });

    const vistos = new Map();
    for (const h of horarios) {
      const s = h.staff;
      if (!s || vistos.has(s.documentId)) continue;

      const perfil = await strapi.documents('api::identity.profile').findFirst({
        filters: { user: { documentId: s.documentId } },
      });

      vistos.set(s.documentId, {
        documentId: s.documentId,
        email: s.email,
        nombre: perfil ? `${perfil.firstName} ${perfil.lastName}` : s.username,
        ocupacion: perfil?.occupation ?? null,
        consultorio: h.room?.name ?? null,
        slotMinutes: h.slotMinutes,
      });
    }

    return [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  /**
   * La semana de uno o varios profesionales: huecos libres y citas ocupadas,
   * en la misma rejilla.
   */
  async semana(desdeFecha, staffIds) {
    const lunes = lunesDe(desdeFecha);
    const domingo = sumarDias(lunes, 6);

    const disponibilidad = strapi.service('api::scheduling.availability');
    const todos = await this.personal();
    const elegidos = todos.filter((s) => staffIds.includes(s.documentId));

    const columnas = [];

    for (const s of elegidos) {
      const libres = await disponibilidad.huecos(s.documentId, lunes, domingo);

      const citas = await strapi.documents('api::scheduling.appointment').findMany({
        filters: {
          responsible: { documentId: s.documentId },
          startAt: { $gte: `${lunes}T00:00:00.000Z`, $lte: `${domingo}T23:59:59.999Z` },
        },
        populate: {
          pet: { populate: { owner: { populate: ['profile'] } } },
          room: true,
          consultation: true,
        },
        sort: 'startAt:asc',
      });

      columnas.push({
        staff: s,
        dias: libres.dias ?? [],
        citas: citas.map((c) => ({
          documentId: c.documentId,
          startAt: c.startAt,
          endAt: c.endAt,
          state: c.state,
          title: c.title,
          bloquea: BLOQUEAN.includes(c.state),
          mascota: c.pet ? { documentId: c.pet.documentId, nombre: c.pet.name } : null,
          propietario: c.pet?.owner?.profile
            ? `${c.pet.owner.profile.firstName} ${c.pet.owner.profile.lastName}`
            : null,
          consultorio: c.room?.name ?? null,
          // Si ya tiene consulta, el botón lleva a ella en vez de crear otra.
          consultationDocumentId: c.consultation?.documentId ?? null,
        })),
      });
    }

    return { lunes, domingo, columnas };
  },

  /** Cambia el estado de una cita (llegó, en curso, atendida, no vino...). */
  async cambiarEstado(documentId, estado) {
    return strapi.documents('api::scheduling.appointment').update({
      documentId,
      data: { state: estado },
    });
  },

  /**
   * Crea la consulta de una cita con lo que ya se sabe: mascota, veterinario
   * responsable, fecha y el enlace a la cita. Devuelve su documentId para que
   * la interfaz salte al formulario del Content Manager.
   *
   * Es idempotente: si la cita ya tiene consulta, devuelve esa.
   */
  async abrirConsulta(documentId) {
    const cita = await strapi.documents('api::scheduling.appointment').findOne({
      documentId,
      populate: { pet: true, responsible: true, consultation: true },
    });

    if (!cita) throw new Error('La cita no existe');
    if (cita.consultation) {
      return { documentId: cita.consultation.documentId, creada: false };
    }
    if (!cita.pet || !cita.responsible) {
      throw new Error('La cita necesita mascota y responsable para abrir la consulta');
    }

    const consulta = await strapi.documents('api::clinical.consultation').create({
      data: {
        pet: cita.pet.documentId,
        vet: cita.responsible.documentId,
        appointment: cita.documentId,
        consultedAt: cita.startAt,
        reason: cita.title ?? null,
      },
    });

    // La cita pasa a "en curso": se está atendiendo.
    if (BLOQUEAN.includes(cita.state) && cita.state !== 'in_progress') {
      await strapi.documents('api::scheduling.appointment').update({
        documentId,
        data: { state: 'in_progress' },
      });
    }

    return { documentId: consulta.documentId, creada: true };
  },
});
