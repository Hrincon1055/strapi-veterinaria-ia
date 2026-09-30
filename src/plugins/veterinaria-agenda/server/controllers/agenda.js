'use strict';

const VER_TODAS = 'plugin::veterinaria-agenda.agenda.ver-todas';
const AGENDAR = 'plugin::veterinaria-agenda.agenda.agendar';
const FINALIZAR = 'plugin::veterinaria-agenda.agenda.finalizar';
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
// Debe coincidir con el modal de reserva.
const MOTIVO_MINIMO = 5;

/** ¿Este administrador puede ver la agenda de todo el personal? */
function puedeVerTodas(ctx) {
  const permisos = ctx.state?.userAbility;
  return Boolean(permisos?.can(VER_TODAS));
}

/** ¿Puede reservar en un hueco libre? Recepción sí; el veterinario, no. */
function puedeAgendar(ctx) {
  return Boolean(ctx.state?.userAbility?.can(AGENDAR));
}

/** ¿Puede dar por atendida una cita? El veterinario sí; recepción, no. */
function puedeFinalizar(ctx) {
  return Boolean(ctx.state?.userAbility?.can(FINALIZAR));
}

module.exports = ({ strapi }) => {
  const svc = () => strapi.plugin('veterinaria-agenda').service('agenda');

  return {
    async quienSoy(ctx) {
      const yo = await svc().quienSoy(ctx.state.user.id);
      // La interfaz necesita los dos para decidir qué pinta: sin `puedeAgendar`
      // los huecos se quedan como fondo inerte, que es lo que ve un veterinario.
      ctx.body = {
        ...yo,
        puedeVerTodas: puedeVerTodas(ctx),
        puedeAgendar: puedeAgendar(ctx),
        puedeFinalizar: puedeFinalizar(ctx),
      };
    },

    async personal(ctx) {
      // Quien no puede ver todas las agendas tampoco necesita la lista
      // completa: se le devuelve solo él mismo.
      const todos = await svc().personal();
      if (puedeVerTodas(ctx)) {
        ctx.body = { data: todos };
        return;
      }
      const yo = await svc().quienSoy(ctx.state.user.id);
      ctx.body = { data: todos.filter((s) => s.documentId === yo.staffDocumentId) };
    },

    async semana(ctx) {
      const { desde, staff } = ctx.query ?? {};
      if (desde && !FECHA.test(String(desde))) {
        return ctx.badRequest('"desde" debe ser una fecha AAAA-MM-DD');
      }

      const yo = await svc().quienSoy(ctx.state.user.id);
      const pedidos = String(staff ?? '').split(',').map((s) => s.trim()).filter(Boolean);

      // La restricción se aplica en el servidor, no en la interfaz: quien no
      // tenga el permiso solo ve lo suyo aunque pida otra cosa.
      let ids;
      if (puedeVerTodas(ctx)) {
        ids = pedidos.length > 0 ? pedidos : (await svc().personal()).map((s) => s.documentId);
      } else {
        if (!yo.staffDocumentId) {
          return ctx.badRequest(
            'Tu cuenta del panel no tiene horario de atención. ' +
              'Créalo en Content Manager -> Horario de atención, con tu cuenta en "Profesional".'
          );
        }
        ids = [yo.staffDocumentId];
      }

      ctx.body = { data: await svc().semana(String(desde ?? new Date().toISOString().slice(0, 10)), ids) };
    },

    async mascotas(ctx) {
      ctx.body = { data: await svc().mascotas(ctx.query?.q) };
    },

    async reservar(ctx) {
      const { staff, mascota, startAt, motivo } = ctx.request.body ?? {};

      if (!staff || !mascota || !startAt) {
        return ctx.badRequest('Faltan datos: hacen falta staff, mascota y startAt');
      }

      if (typeof motivo !== 'string' || motivo.trim().length < MOTIVO_MINIMO) {
        return ctx.badRequest(`El motivo de la consulta necesita al menos ${MOTIVO_MINIMO} caracteres`);
      }

      // Mismo criterio que en la lectura: quien no puede ver todas las
      // agendas tampoco puede llenar la de otro. Sin esto, recepción con
      // permisos recortados podría agendarle a cualquiera.
      if (!puedeVerTodas(ctx)) {
        const yo = await svc().quienSoy(ctx.state.user.id);
        if (!yo.staffDocumentId || yo.staffDocumentId !== staff) {
          return ctx.forbidden('Solo puedes reservar en tu propia agenda');
        }
      }

      try {
        ctx.body = {
          data: await svc().reservar({
            staffDocumentId: staff,
            petDocumentId: mascota,
            startAt,
            motivo,
          }),
        };
      } catch (e) {
        // Aquí caen tanto el hueco ya ocupado como las validaciones del
        // Document Service sobre la cita.
        return ctx.badRequest(e.message);
      }
    },

    async cambiarEstado(ctx) {
      const { documentId } = ctx.params;
      const { estado } = ctx.request.body ?? {};
      const VALIDOS = ['scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show'];
      if (!VALIDOS.includes(estado)) {
        return ctx.badRequest(`Estado no válido. Usa uno de: ${VALIDOS.join(', ')}`);
      }
      // La regla del Document Service lo rechazaría igual, pero con un 400;
      // aquí es un 403, que es lo que es.
      if (estado === 'completed' && !puedeFinalizar(ctx)) {
        return ctx.forbidden('Solo quien atiende puede dar la cita por atendida');
      }
      try {
        ctx.body = { data: await svc().cambiarEstado(documentId, estado) };
      } catch (e) {
        // Las validaciones del Document Service siguen aplicando: cancelar
        // exige motivo, por ejemplo.
        return ctx.badRequest(e.message);
      }
    },

    async abrirConsulta(ctx) {
      try {
        ctx.body = { data: await svc().abrirConsulta(ctx.params.documentId) };
      } catch (e) {
        return ctx.badRequest(e.message);
      }
    },

    /** Estado de la cita de una consulta, para el panel lateral de la ficha. */
    async atencion(ctx) {
      try {
        ctx.body = {
          data: { cita: await svc().citaDeConsulta(ctx.params.documentId), puedeFinalizar: puedeFinalizar(ctx) },
        };
      } catch (e) {
        return ctx.badRequest(e.message);
      }
    },

    async finalizarAtencion(ctx) {
      try {
        ctx.body = { data: await svc().finalizarAtencion(ctx.params.documentId) };
      } catch (e) {
        return ctx.badRequest(e.message);
      }
    },

    async reabrirAtencion(ctx) {
      try {
        ctx.body = { data: await svc().finalizarAtencion(ctx.params.documentId, { reabrir: true }) };
      } catch (e) {
        return ctx.badRequest(e.message);
      }
    },
  };
};
