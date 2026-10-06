import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { crearFormulaApi } from '../infrastructure/formulaApi';
import { mensajeDeError } from '../domain/formato';

/**
 * Casos de uso de la fórmula médica. Los componentes leen este estado; nunca
 * hacen fetch.
 */

function useFormulaApi() {
  const fetchClient = useFetchClient();
  return useMemo(() => crearFormulaApi(fetchClient), [fetchClient]);
}

/** Panel lateral de la consulta: medicamentos del plan, fórmulas emitidas, emitir y anular. */
export function useFormulasDeConsulta(consultaId) {
  const api = useFormulaApi();
  const { toggleNotification } = useNotification();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await api.deConsulta(consultaId));
    } catch (e) {
      if (e?.response?.status === 403) setSinPermiso(true);
      else setError(mensajeDeError(e, 'No se pudieron cargar las fórmulas'));
    } finally {
      setCargando(false);
    }
  }, [api, consultaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const accion = useCallback(
    async (fn, exito) => {
      setEnviando(true);
      try {
        const r = await fn();
        toggleNotification({ type: 'success', message: exito(r) });
        await cargar();
        return r;
      } catch (e) {
        toggleNotification({ type: 'danger', message: mensajeDeError(e, 'No se pudo completar la operación') });
        return null;
      } finally {
        setEnviando(false);
      }
    },
    [cargar, toggleNotification]
  );

  const emitir = useCallback(
    (medicamentos) => accion(() => api.emitir(consultaId, medicamentos), (f) => `Fórmula ${f.numero} emitida`),
    [accion, api, consultaId]
  );
  const anular = useCallback(
    (formulaId, motivo) => accion(() => api.anular(formulaId, motivo), (f) => `Fórmula ${f.numero} anulada`),
    [accion, api]
  );

  return { datos, cargando, error, sinPermiso, enviando, emitir, anular, recargar: cargar };
}

/** Lo que se imprime. */
export function useFichaFormula(formulaId) {
  const api = useFormulaApi();
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null });

  useEffect(() => {
    let vivo = true;
    setEstado({ datos: null, cargando: true, error: null });
    api
      .ficha(formulaId)
      .then((datos) => vivo && setEstado({ datos, cargando: false, error: null }))
      .catch((e) => vivo && setEstado({ datos: null, cargando: false, error: mensajeDeError(e, 'No se pudo cargar la fórmula') }));
    return () => {
      vivo = false;
    };
  }, [api, formulaId]);

  return estado;
}
