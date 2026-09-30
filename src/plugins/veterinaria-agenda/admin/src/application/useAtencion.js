import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { crearAgendaApi } from '../infrastructure/agendaApi';

/**
 * Aplicación: el cierre de la atención desde la ficha de la consulta.
 *
 * No usa el store de la agenda: el panel vive en el Content Manager, fuera de
 * la página del plugin, y la agenda vuelve a pedir la semana al montarse, así
 * que al regresar al calendario la cita ya sale como atendida.
 *
 * Cuando finalizar cambia la consulta (añade el servicio de la visita),
 * el formulario abierto queda desactualizado: si se guardara después,
 * reenviaría la zona de líneas sin el cargo y lo borraría. Por eso en ese caso
 * se recarga la ficha. El panel no deja finalizar con cambios sin guardar, así
 * que la recarga no pierde nada.
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

  // La lista de servicios solo hace falta si hay que elegir el cargo.
  const d = estado.datos;
  const hayQueElegir = Boolean(d?.puedeFinalizar && d.cita && d.cita.state !== 'completed' && !d.tieneCargo);
  useEffect(() => {
    if (!hayQueElegir || servicios) return;
    api.servicios().then(setServicios).catch(() => setServicios([]));
  }, [api, hayQueElegir, servicios]);

  const ejecutar = useCallback(
    async (accion, exito, { recargar = false } = {}) => {
      setEnviando(true);
      try {
        const nuevo = await accion();
        toggleNotification({ type: 'success', message: exito });
        if (recargar) {
          window.location.reload();
          return;
        }
        setEstado((s) => ({ datos: { ...s.datos, ...nuevo } }));
      } catch (e) {
        toggleNotification({
          type: 'danger',
          message: e?.response?.data?.error?.message ?? 'No se pudo actualizar la cita',
        });
      } finally {
        setEnviando(false);
      }
    },
    [toggleNotification]
  );

  /** `decision`: nada si ya tiene servicio; `{ servicio }` si no. */
  const finalizar = useCallback(
    (decision = {}) =>
      ejecutar(
        () => api.finalizarAtencion(consultaId, decision),
        decision.servicio
          ? 'Atención finalizada; el servicio queda pendiente de cobro en Facturación'
          : 'Atención finalizada: la cita queda como atendida',
        { recargar: Boolean(decision.servicio) }
      ),
    [api, consultaId, ejecutar]
  );
  const reabrir = useCallback(
    () => ejecutar(() => api.reabrirAtencion(consultaId), 'Atención reabierta: la cita vuelve a "En curso"'),
    [api, consultaId, ejecutar]
  );

  return { ...estado, enviando, servicios, hayQueElegir, finalizar, reabrir };
}
