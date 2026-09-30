import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { crearAgendaApi } from '../infrastructure/agendaApi';

/**
 * Aplicación: el cierre de la atención desde la ficha de la consulta.
 *
 * No usa el store de la agenda: el panel vive en el Content Manager, fuera de
 * la página del plugin, y la agenda vuelve a pedir la semana al montarse, así
 * que al regresar al calendario la cita ya sale como atendida.
 */
export function useAtencion(consultaId) {
  const fetchClient = useFetchClient();
  const { toggleNotification } = useNotification();
  const api = useMemo(() => crearAgendaApi(fetchClient), [fetchClient]);

  const [estado, setEstado] = useState({ cargando: true });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setEstado({ cargando: true });
    api.atencion(consultaId)
      .then((datos) => vivo && setEstado({ datos }))
      // Sin permiso de agenda (403) el panel se calla: no es un error de la consulta.
      .catch((e) => vivo && setEstado({ sinPermiso: e?.response?.status === 403, error: true }));
    return () => { vivo = false; };
  }, [api, consultaId]);

  const ejecutar = useCallback(
    async (accion, exito) => {
      setEnviando(true);
      try {
        const cita = await accion(consultaId);
        setEstado((s) => ({ datos: { ...s.datos, cita } }));
        toggleNotification({ type: 'success', message: exito });
      } catch (e) {
        toggleNotification({
          type: 'danger',
          message: e?.response?.data?.error?.message ?? 'No se pudo actualizar la cita',
        });
      } finally {
        setEnviando(false);
      }
    },
    [consultaId, toggleNotification]
  );

  const finalizar = useCallback(
    () => ejecutar(api.finalizarAtencion, 'Atención finalizada: la cita queda como atendida'),
    [api, ejecutar]
  );
  const reabrir = useCallback(
    () => ejecutar(api.reabrirAtencion, 'Atención reabierta: la cita vuelve a "En curso"'),
    [api, ejecutar]
  );

  return { ...estado, enviando, finalizar, reabrir };
}
