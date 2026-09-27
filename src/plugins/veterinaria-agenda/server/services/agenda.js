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

/** Lo que la rejilla necesita de una cita, y nada más. */
function aTarjeta(c) {
  return {
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
  };
}

/** Lo que hay que poblar para construir una tarjeta. */
const POPULATE_CITA = {
  pet: { populate: { owner: { populate: ['profile'] } } },
  room: true,
  consultation: true,
};

/**
 * Los huecos se emiten en la hora local del horario, sin zona
 * (`2026-09-21T07:00:00.000`), y las citas se guardan en UTC. Para comparar
 * "¿es este hueco?" se quita la Z de los dos lados.
 */
const sinZona = (iso) => String(iso ?? '').replace(/Z$/, '');

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
        populate: POPULATE_CITA,
        sort: 'startAt:asc',
      });

      columnas.push({
        staff: s,
        dias: libres.dias ?? [],
        citas: citas.map(aTarjeta),
      });
    }

    return { lunes, domingo, columnas };
  },

  /**
   * Mascotas para el selector de "nueva cita".
   *
   * Busca por el `searchLabel`, que es justamente la columna que existe para
   * esto: lleva nombre, especie y dueño concatenados, así que "kira" y
   * "restrepo" encuentran la misma ficha. Sin texto devuelve las últimas
   * atendidas, que es lo que recepción suele necesitar.
   */
  async mascotas(texto) {
    const q = String(texto ?? '').trim();

    const mascotas = await strapi.documents('api::pet.pet').findMany({
      filters: q
        ? { $or: [{ searchLabel: { $containsi: q } }, { name: { $containsi: q } }] }
        : {},
      populate: { owner: { populate: ['profile'] }, species: true },
      sort: 'name:asc',
      limit: 20,
    });

    return mascotas.map((m) => ({
      documentId: m.documentId,
      nombre: m.name,
      especie: m.species?.name ?? null,
      propietario: m.owner?.profile
        ? `${m.owner.profile.firstName} ${m.owner.profile.lastName}`
        : null,
    }));
  },

  /**
   * Reserva una cita en un hueco libre.
   *
   * **Se vuelve a comprobar que el hueco esté libre**, en vez de creer lo que
   * manda el cliente. Entre que se pintó la rejilla y que alguien pulsa pueden
   * pasar minutos, y en recepción hay varias personas agendando a la vez: sin
   * esta comprobación se crearían dos citas en el mismo tramo. El servidor
   * pide los huecos otra vez y exige que el pedido siga estando entre ellos.
   *
   * También ata la duración al hueco: no se acepta un `endAt` del cliente,
   * porque permitiría pisar el tramo siguiente.
   */
  async reservar({ staffDocumentId, petDocumentId, startAt, motivo, adminUserId }) {
    const dia = sinZona(startAt).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
      throw new Error('La hora de inicio no es válida');
    }

    const libres = await strapi.service('api::scheduling.availability').huecos(
      staffDocumentId,
      dia,
      dia
    );

    const hueco = (libres.dias ?? [])
      .flatMap((d) => d.huecos ?? [])
      .find((h) => sinZona(h.startAt) === sinZona(startAt));

    if (!hueco) {
      // Los dos motivos se sienten igual desde fuera pero se arreglan de
      // forma distinta: uno se resuelve actualizando la rejilla, el otro es
      // una hora que ese profesional no atiende. Decirlo mal manda a
      // recepción a buscar donde no es.
      const choca = await strapi.documents('api::scheduling.appointment').findFirst({
        filters: {
          responsible: { documentId: staffDocumentId },
          startAt: `${sinZona(startAt)}Z`,
          state: { $in: BLOQUEAN },
        },
      });

      throw new Error(
        choca
          ? 'Ese hueco acaba de ocuparse. Actualiza la agenda y elige otro.'
          : 'Esa hora no es un hueco del horario de ese profesional.'
      );
    }

    const mascota = await strapi.documents('api::pet.pet').findOne({ documentId: petDocumentId });
    if (!mascota) throw new Error('La mascota no existe');

    // Quién reserva: la cuenta de app de quien está en el panel, si la tiene
    // enlazada. Si no, se deja vacío antes que atribuirlo a otra persona.
    const perfil = adminUserId
      ? await strapi.documents('api::identity.profile').findFirst({
          filters: { adminUser: { id: adminUserId } },
          populate: ['user'],
        })
      : null;

    const creada = await strapi.documents('api::scheduling.appointment').create({
      data: {
        pet: petDocumentId,
        responsible: staffDocumentId,
        room: hueco.room ?? undefined,
        startAt: `${sinZona(hueco.startAt)}Z`,
        endAt: `${sinZona(hueco.endAt)}Z`,
        state: 'scheduled',
        source: 'front_desk',
        title: motivo?.trim() || null,
        bookedBy: perfil?.user?.documentId ?? undefined,
      },
    });

    const conDatos = await strapi.documents('api::scheduling.appointment').findOne({
      documentId: creada.documentId,
      populate: POPULATE_CITA,
    });

    return aTarjeta(conDatos);
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
