import { useCallback, useEffect, useMemo } from 'react';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { crearAgendaApi } from '../infrastructure/agendaApi';
import { useAgendaStore } from '../presentation/store';

/**
 * Aplicación: orquesta dominio, repositorio y estado.
 *
 * Es la única capa que conoce las tres. Los componentes llaman a estas
 * acciones y leen del store; nunca hacen fetch ni calculan fechas.
 */
export function useAgenda() {
  const fetchClient = useFetchClient();
  const { toggleNotification } = useNotification();
  const api = useMemo(() => crearAgendaApi(fetchClient), [fetchClient]);

  const {
    lunes, vista, seleccion, yo, personal, semana, cargando, error,
    setContexto, setSemana, setEstadoCarga, actualizarCita, agregarCita,
  } = useAgendaStore();

  const avisar = useCallback(
    (type, message) => toggleNotification({ type, message }),
    [toggleNotification]
  );

  // --- arranque: quién soy y a quién puedo ver ---
  useEffect(() => {
    let vivo = true;
    (async () => {
      setEstadoCarga(true);
      try {
        const [quien, gente] = await Promise.all([api.quienSoy(), api.personal()]);
        if (!vivo) return;
        // Se arranca en "mi agenda" si hay enlace; si no, en general, que es
        // lo único que esa cuenta puede ver.
        const personalPorDefecto = quien.staffDocumentId
          ? [quien.staffDocumentId]
          : gente.map((s) => s.documentId);
        setContexto({ yo: quien, personal: gente, seleccion: personalPorDefecto });
        setEstadoCarga(false);
      } catch (e) {
        if (vivo) setEstadoCarga(false, e?.response?.data?.error?.message ?? e.message);
      }
    })();
    return () => { vivo = false; };
  }, [api, setContexto, setEstadoCarga]);

  // --- carga de la semana cuando cambia algo que la define ---
  useEffect(() => {
    if (seleccion.length === 0) { setSemana(null); return; }
    let vivo = true;
    (async () => {
      setEstadoCarga(true);
      try {
        const datos = await api.semana(lunes, seleccion);
        if (vivo) { setSemana(datos); setEstadoCarga(false); }
      } catch (e) {
        if (vivo) setEstadoCarga(false, e?.response?.data?.error?.message ?? e.message);
      }
    })();
    return () => { vivo = false; };
  }, [api, lunes, seleccion, setSemana, setEstadoCarga]);

  const cambiarEstado = useCallback(
    async (documentId, estado) => {
      try {
        await api.cambiarEstado(documentId, estado);
        actualizarCita(documentId, { state: estado });
        avisar('success', 'Cita actualizada');
      } catch (e) {
        avisar('danger', e?.response?.data?.error?.message ?? 'No se pudo actualizar la cita');
      }
    },
    [api, actualizarCita, avisar]
  );

  const buscarMascotas = useCallback((q) => api.buscarMascotas(q), [api]);
  const cargarServicios = useCallback(() => api.servicios(), [api]);

  /**
   * Reserva en un hueco libre. Devuelve `true` si se creó, para que el modal
   * sepa si cerrarse.
   *
   * No recarga la semana entera: mete la cita y borra el hueco en el store.
   * Recargar haría parpadear la rejilla y perdería la posición del scroll,
   * que en una vista de 5 días con 13 tramos molesta.
   */
  const reservar = useCallback(
    async ({ staff, mascota, startAt, motivo, servicio }) => {
      try {
        const cita = await api.reservar({ staff, mascota, startAt, motivo, servicio });
        agregarCita(staff, cita);
        avisar('success', `Cita reservada para ${cita.mascota?.nombre ?? 'la mascota'}`);
        return true;
      } catch (e) {
        avisar('danger', e?.response?.data?.error?.message ?? 'No se pudo reservar la cita');
        return false;
      }
    },
    [api, agregarCita, avisar]
  );

  /**
   * Abre la consulta de una cita. Devuelve la ruta del Content Manager para
   * que el componente navegue: la consulta ya viene con mascota, veterinario
   * y fecha precargados.
   */
  const abrirConsulta = useCallback(
    async (documentId) => {
      try {
        const r = await api.abrirConsulta(documentId);
        actualizarCita(documentId, { consultationDocumentId: r.documentId, state: 'in_progress' });
        avisar('success', r.creada ? 'Consulta creada con los datos de la cita' : 'La cita ya tenía consulta');
        return `/content-manager/collection-types/api::clinical.consultation/${r.documentId}`;
      } catch (e) {
        avisar('danger', e?.response?.data?.error?.message ?? 'No se pudo abrir la consulta');
        return null;
      }
    },
    [api, actualizarCita, avisar]
  );

  return {
    lunes, vista, seleccion, yo, personal, semana, cargando, error,
    cambiarEstado, abrirConsulta, buscarMascotas, cargarServicios, reservar,
  };
}
