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
    servicios: (c.services ?? []).map((s) => s.service?.name).filter(Boolean),
    // Si ya tiene consulta, el botón lleva a ella en vez de crear otra.
    consultationDocumentId: c.consultation?.documentId ?? null,
  };
}

/** Las dos tarjetas de "Servicios y productos" de la consulta, con su relación. */
const LINEAS_CONSULTA = {
  lines: {
    on: {
      'clinical.service-line': { populate: { service: { fields: ['documentId', 'name'] } } },
      'clinical.product-line': { populate: { product: { fields: ['documentId'] } } },
    },
  },
};

/** Lo que hay que poblar para construir una tarjeta. */
const POPULATE_CITA = {
  pet: { populate: { owner: { populate: ['profile'] } } },
  room: true,
  consultation: true,
  services: { populate: { service: { fields: ['name'] } } },
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
   * Quién es la cuenta del panel que está mirando.
   *
   * El staff ES su cuenta del panel: `responsible`, `staff` y `vet` apuntan
   * a `admin::user`, así que no hace falta ningún puente para saber de quién
   * es la agenda. El perfil (`profile.adminUser`) solo aporta nombre completo
   * y ocupación, y es opcional.
   *
   * Tener agenda personal = tener un horario. Una cuenta sin horario (el
   * Super Admin, por ejemplo) no tiene "Mi agenda": la interfaz lo dice en
   * vez de mostrar un calendario vacío que parece un error.
   */
  async quienSoy(adminUserId) {
    const cuenta = await strapi.db.query('admin::user').findOne({
      where: { id: adminUserId },
      select: ['documentId', 'firstname', 'lastname'],
    });
    const perfil = await strapi.documents('api::identity.profile').findFirst({
      filters: { adminUser: { id: adminUserId } },
    });
    const horarios = await strapi.documents('api::scheduling.staff-schedule').count({
      filters: { staff: { id: adminUserId } },
    });

    return {
      adminUserId,
      profileDocumentId: perfil?.documentId ?? null,
      nombre: perfil
        ? `${perfil.firstName} ${perfil.lastName}`
        : [cuenta?.firstname, cuenta?.lastname].filter(Boolean).join(' ') || null,
      staffDocumentId: horarios > 0 ? cuenta?.documentId ?? null : null,
      enlazado: horarios > 0,
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

      // `s` es la cuenta del panel; el perfil, si está enlazado, da la ocupación.
      const perfil = await strapi.documents('api::identity.profile').findFirst({
        filters: { adminUser: { documentId: s.documentId } },
      });

      vistos.set(s.documentId, {
        documentId: s.documentId,
        email: s.email,
        nombre: perfil
          ? `${perfil.firstName} ${perfil.lastName}`
          : [s.firstname, s.lastname].filter(Boolean).join(' ') || s.email,
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
  async reservar({ staffDocumentId, petDocumentId, startAt, motivo, servicioDocumentId }) {
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

    const servicio = await strapi.documents('api::scheduling.service').findOne({
      documentId: servicioDocumentId,
      fields: ['isActive'],
    });
    if (!servicio?.isActive) throw new Error('El servicio elegido no existe o no está activo');

    // `bookedBy` no se pasa: lo fija src/validations/actor.ts con el perfil
    // de la cuenta del panel que está reservando.
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
        // El servicio de la visita: al abrir la consulta pasa a ser su línea
        // `applied` (abrirConsulta), y el veterinario ya no tiene que decir
        // qué atendió. La duración de la cita sigue siendo la del hueco.
        services: [{ service: servicioDocumentId }],
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
    // Marcar atendida desde la agenda con consulta = finalizar la atención
    // con el servicio por defecto de Clínica si falta el cargo. Quien quiera
    // registrar otro servicio lo hace desde el panel Atención de la consulta.
    if (estado === 'completed') {
      const cita = await strapi.documents('api::scheduling.appointment').findOne({
        documentId,
        populate: { consultation: { fields: ['documentId'] } },
      });
      if (cita?.consultation && cita.state !== 'completed') {
        await this.finalizarAtencion(cita.consultation.documentId, { usarPorDefecto: true });
        return strapi.documents('api::scheduling.appointment').findOne({ documentId });
      }
    }
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
      populate: {
        pet: true,
        responsible: true,
        consultation: true,
        services: { populate: { service: { fields: ['documentId'] } } },
      },
    });

    if (!cita) throw new Error('La cita no existe');
    if (cita.consultation) {
      return { documentId: cita.consultation.documentId, creada: false };
    }
    if (!cita.pet || !cita.responsible) {
      throw new Error('La cita necesita mascota y responsable para abrir la consulta');
    }

    // Los servicios agendados pasan a ser líneas `applied` de la consulta: el
    // cargo de "Consulta general" no depende de que el veterinario se acuerde
    // de añadirlo. Si no se prestó, lo quita o lo pasa a `recommended`.
    // El precio de la cita no se copia: la factura toma el del catálogo.
    const lines = (cita.services ?? [])
      .filter((s) => s.service?.documentId)
      .map((s) => ({
        __component: 'clinical.service-line',
        service: s.service.documentId,
        quantity: 1,
        state: 'applied',
      }));

    const consulta = await strapi.documents('api::clinical.consultation').create({
      data: {
        pet: cita.pet.documentId,
        vet: cita.responsible.documentId,
        appointment: cita.documentId,
        consultedAt: cita.startAt,
        reason: cita.title ?? null,
        ...(lines.length > 0 ? { lines } : {}),
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

  /**
   * La cita de una consulta, para el panel lateral de la ficha. `null` si la
   * consulta se creó sin cita (urgencia registrada a mano en el panel).
   */
  async citaDeConsulta(consultaDocumentId) {
    const consulta = await strapi.documents('api::clinical.consultation').findOne({
      documentId: consultaDocumentId,
      populate: { appointment: { fields: ['documentId', 'state', 'startAt', 'endAt', 'completedAt'] } },
    });
    if (!consulta) throw new Error('La consulta no existe');
    const c = consulta.appointment;
    return c
      ? { documentId: c.documentId, state: c.state, startAt: c.startAt, endAt: c.endAt, completedAt: c.completedAt }
      : null;
  },

  /**
   * Lo que el panel de atención necesita: la cita (si la hay), el servicio de
   * la visita y el que se propondría si aún no tiene.
   */
  async atencion(consultaDocumentId) {
    const [cita, { lineas, visita, ...cargo }] = await Promise.all([
      this.citaDeConsulta(consultaDocumentId),
      this.cargoDeConsulta(consultaDocumentId),
    ]);
    return {
      cita,
      ...cargo,
      servicioVisita: visita ? { documentId: visita.service?.documentId, nombre: visita.service?.name } : null,
    };
  },

  /**
   * El servicio de la visita es la PRIMERA línea de servicio `applied`: la que
   * llega de la reserva (abrirConsulta la pone primera) o la que añade el
   * panel cuando no había ninguna. Otros servicios que añada el veterinario
   * (una anestesia, un hemograma) van detrás y el panel no los toca.
   */
  async cargoDeConsulta(consultaDocumentId) {
    const consulta = await strapi.documents('api::clinical.consultation').findOne({
      documentId: consultaDocumentId,
      fields: ['documentId'],
      populate: LINEAS_CONSULTA,
    });
    if (!consulta) throw new Error('La consulta no existe');

    const clinica = await strapi.documents('api::clinic.clinic').findFirst({
      populate: { defaultConsultationService: { fields: ['documentId', 'name', 'basePrice', 'isActive'] } },
    });
    const porDefecto = clinica?.defaultConsultationService;
    const lineas = consulta.lines ?? [];
    const visita = lineas.find((l) => l.__component === 'clinical.service-line' && l.state === 'applied') ?? null;

    return {
      tieneCargo: Boolean(visita),
      servicioPorDefecto: porDefecto?.isActive ? { documentId: porDefecto.documentId, nombre: porDefecto.name } : null,
      visita,
      lineas,
    };
  },

  /**
   * Servicios activos, para el servicio de la visita (al reservar y en el
   * panel Atención). `porDefecto` marca el de Clínica.
   */
  async servicios() {
    const [lista, clinica] = await Promise.all([
      strapi.documents('api::scheduling.service').findMany({
        filters: { isActive: true },
        fields: ['documentId', 'name', 'basePrice'],
        sort: 'name:asc',
      }),
      strapi.documents('api::clinic.clinic').findFirst({
        populate: { defaultConsultationService: { fields: ['documentId'] } },
      }),
    ]);
    const porDefecto = clinica?.defaultConsultationService?.documentId;
    return lista.map((s) => ({
      documentId: s.documentId,
      nombre: s.name,
      precio: s.basePrice,
      porDefecto: s.documentId === porDefecto,
    }));
  },

  /**
   * Deja `servicio` como servicio de la visita: lo añade si la consulta no
   * tiene ninguno, cambia el de la línea de la visita si es otro (la
   * recepcionista se equivocó al reservar) y no hace nada si ya es ese.
   * Devuelve si escribió en la consulta, para que el panel recargue la ficha.
   *
   * La zona `lines` se reescribe entera: las líneas se reenvían con su `id` y
   * su `lineKey`, para que la facturación las siga reconociendo (ver
   * `asignarClaves` en validations/clinical.ts). Si la línea ya está en una
   * factura viva, esa misma regla rechaza el cambio.
   */
  async definirServicio(consultaDocumentId, servicio, cargo) {
    const { visita, lineas } = cargo ?? (await this.cargoDeConsulta(consultaDocumentId));
    if (visita && visita.service?.documentId === servicio) return false;

    const elegido = await strapi.documents('api::scheduling.service').findOne({
      documentId: servicio,
      fields: ['isActive'],
    });
    if (!elegido?.isActive) throw new Error('El servicio elegido no existe o no está activo');

    const nuevas = visita
      ? lineas.map((l) => (l.id === visita.id && l.__component === visita.__component
        ? { ...reenviarLinea(l), service: servicio }
        : reenviarLinea(l)))
      : [...lineas.map(reenviarLinea), { __component: 'clinical.service-line', service: servicio, quantity: 1, state: 'applied' }];

    await strapi.documents('api::clinical.consultation').update({
      documentId: consultaDocumentId,
      data: { lines: nuevas },
    });
    return true;
  },

  /**
   * Cambia el servicio de la visita sin tocar la cita: una cita ya atendida,
   * o una consulta sin cita a la que se le corrige el servicio.
   */
  async registrarServicio(consultaDocumentId, servicio) {
    if (!servicio) throw new Error('Elige el servicio que corresponde a la visita');
    const consultaCambiada = await this.definirServicio(consultaDocumentId, servicio);
    return { ...(await this.atencion(consultaDocumentId)), consultaCambiada };
  },

  /**
   * Da por atendida una consulta con el servicio de la visita elegido, o
   * reabre su cita si se cerró por error. Guardar la consulta no la cierra: el
   * veterinario guarda varias veces durante la visita y cerrarla antes
   * liberaría su tramo en la agenda con el paciente todavía en el consultorio.
   *
   * **La consulta atendida siempre lleva servicio; si se cobra lo decide
   * Facturación**, no el veterinario. `servicio` es el que eligió el
   * veterinario en el panel (propuesto: el de la reserva, o el de Clínica);
   * con `usarPorDefecto` y sin servicio elegido se usa el de Clínica si falta
   * (agenda, cierre nocturno). Sin ninguno y sin servicio en la consulta, se
   * rechaza. Recepción decide al facturar; una cortesía va con descuento del
   * 100 % en el renglón.
   *
   * Sin cita (urgencia, atención no prevista) no hay nada que cerrar en la
   * agenda: finalizar es dejar registrado el servicio.
   *
   * Todo en una transacción: si el servicio no se puede guardar, la cita no
   * se cierra.
   *
   * Reabrir vuelve a `in_progress`, que bloquea agenda otra vez; si entre
   * tanto recepción agendó en ese tramo, la regla de solapamiento lo rechaza.
   */
  async finalizarAtencion(consultaDocumentId, { reabrir = false, servicio = null, usarPorDefecto = false } = {}) {
    const cita = await this.citaDeConsulta(consultaDocumentId);

    if (reabrir) {
      if (!cita) throw new Error('Esta consulta no viene de una cita: no hay nada que reabrir');
      if (cita.state !== 'completed') throw new Error('La cita no está atendida: no hay nada que reabrir');
      await strapi.documents('api::scheduling.appointment').update({
        documentId: cita.documentId,
        data: { state: 'in_progress', completedAt: null },
      });
      return { ...(await this.atencion(consultaDocumentId)), consultaCambiada: false };
    }

    if (cita && ['cancelled', 'no_show'].includes(cita.state)) {
      throw new Error('La cita está cancelada o marcada como "no asistió"; cambia su estado desde la agenda');
    }

    const cargo = await this.cargoDeConsulta(consultaDocumentId);
    if (!servicio && !cargo.tieneCargo && usarPorDefecto) servicio = cargo.servicioPorDefecto?.documentId ?? null;
    if (!servicio && !cargo.tieneCargo) {
      throw new Error(
        usarPorDefecto
          ? 'La consulta no tiene servicio y Clínica no tiene "Servicio de consulta por defecto". ' +
              'Finalízala desde la consulta (panel Atención) eligiendo el servicio.'
          : 'Esta consulta no tiene servicio: elige el que corresponde a la visita'
      );
    }

    let consultaCambiada = false;
    await strapi.db.transaction(async () => {
      if (servicio) consultaCambiada = await this.definirServicio(consultaDocumentId, servicio, cargo);

      if (cita && cita.state !== 'completed') {
        await strapi.documents('api::scheduling.appointment').update({
          documentId: cita.documentId,
          data: { state: 'completed' },
        });
      }
    });

    return { ...(await this.atencion(consultaDocumentId)), consultaCambiada };
  },
});

/** Una línea guardada, tal como hay que reenviarla para conservarla. */
function reenviarLinea(l) {
  const campo = l.__component === 'clinical.service-line' ? 'service' : 'product';
  return {
    __component: l.__component,
    id: l.id,
    [campo]: l[campo]?.documentId ?? null,
    quantity: l.quantity,
    state: l.state,
    notes: l.notes ?? null,
    lineKey: l.lineKey,
  };
}
