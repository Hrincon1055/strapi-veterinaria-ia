import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { crearAgendaApi } from '../infrastructure/agendaApi';

/**
 * Aplicación: el servicio de la visita y el cierre de la atención desde la
 * ficha de la consulta.
 *
 * No usa el store de la agenda: el panel vive en el Content Manager, fuera de
 * la página del plugin, y la agenda vuelve a pedir la semana al montarse, así
 * que al regresar al calendario la cita ya sale como atendida.
 *
 * Cuando el servidor escribe en la consulta (añade o cambia el servicio de la
 * visita, `consultaCambiada`), el formulario abierto queda desactualizado: si
 * se guardara después, reenviaría la zona de líneas vieja y desharía el
 * cambio. Por eso en ese caso se recarga la ficha. El panel no deja actuar con
 * cambios sin guardar, así que la recarga no pierde nada.
 */
export function useAtencion(consultaId) {
  const fetchClient = useFetchClient();
  const { toggleNotification } = useNotification();
  const api = useMemo(() => crearAgendaApi(fetchClient), [fetchClient]);

  const [estado, setEstado] = useState({ cargando: true });
  const [enviando, setEnviando] = useState(false);
  const [servicios, setServicios] = useState(null);

  useEffect(() => {
    let vivo = true;
    setEstado({ cargando: true });
    api.atencion(consultaId)
      .then((datos) => vivo && setEstado({ datos }))
      // Sin permiso de agenda (403) el panel se calla: no es un error de la consulta.
      .catch((e) => vivo && setEstado({ sinPermiso: e?.response?.status === 403, error: true }));
    return () => { vivo = false; };
  }, [api, consultaId]);

  // El selector está siempre visible para quien puede finalizar.
  const puedeFinalizar = Boolean(estado.datos?.puedeFinalizar);
  useEffect(() => {
    if (!puedeFinalizar || servicios) return;
    api.servicios().then(setServicios).catch(() => setServicios([]));
  }, [api, puedeFinalizar, servicios]);

  const ejecutar = useCallback(
    async (accion, exito) => {
      setEnviando(true);
      try {
        const { consultaCambiada, ...nuevo } = await accion();
        toggleNotification({ type: 'success', message: exito });
        if (consultaCambiada) {
          window.location.reload();
          return;
        }
        setEstado((s) => ({ datos: { ...s.datos, ...nuevo } }));
      } catch (e) {
        toggleNotification({
          type: 'danger',
          message: e?.response?.data?.error?.message ?? 'No se pudo actualizar la atención',
        });
      } finally {
        setEnviando(false);
      }
    },
    [toggleNotification]
  );

  /** Cierra la atención con ese servicio de la visita (con o sin cita). */
  const finalizar = useCallback(
    (servicio) => ejecutar(() => api.finalizarAtencion(consultaId, { servicio }), 'Atención finalizada'),
    [api, consultaId, ejecutar]
  );
  /** Corrige el servicio de la visita sin tocar la cita. */
  const guardarServicio = useCallback(
    (servicio) => ejecutar(() => api.registrarServicio(consultaId, servicio), 'Servicio de la visita actualizado'),
    [api, consultaId, ejecutar]
  );
  const reabrir = useCallback(
    () => ejecutar(() => api.reabrirAtencion(consultaId), 'Atención reabierta: la cita vuelve a "En curso"'),
    [api, consultaId, ejecutar]
  );

  return { ...estado, enviando, servicios, finalizar, guardarServicio, reabrir };
}
