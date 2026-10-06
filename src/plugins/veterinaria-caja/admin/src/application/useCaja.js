import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { crearCajaApi } from '../infrastructure/cajaApi';
import { mensajeDeError } from '../domain/formato';

/**
 * Aplicación: casos de uso del punto de venta. La única capa que conoce a la
 * vez la API y las notificaciones; los componentes llaman a estas acciones y
 * nunca hacen fetch.
 *
 * El turno donde se cobra lo decide el servidor (el abierto de la cuenta):
 * aquí solo se recarga tras cada operación para mostrar el efectivo esperado.
 */

export function useApi() {
  const fetchClient = useFetchClient();
  const { toggleNotification } = useNotification();
  const api = useMemo(() => crearCajaApi(fetchClient), [fetchClient]);
  const avisar = useCallback((type, message) => toggleNotification({ type, message }), [toggleNotification]);
  return { api, avisar };
}

/** Carga genérica con estado de carga y error; `recargar` la repite sin parpadeo. */
export function useCarga(cargar, deps, { activo = true } = {}) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(activo);
  const [error, setError] = useState(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    if (vuelta === 0) setCargando(true);
    setError(null);
    cargar()
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(mensajeDeError(e, 'No se pudieron cargar los datos')))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, vuelta, activo]);

  return { datos, setDatos, cargando, error, recargar: useCallback(() => setVuelta((v) => v + 1), []) };
}

/** Quién soy, qué puedo hacer y mi turno abierto (si lo hay). */
export function useSesion() {
  const { api } = useApi();
  return useCarga(() => api.quienSoy(), [api]);
}

/**
 * Ejecuta una operación de caja: devuelve su resultado o null si falló (y
 * avisa con el mensaje de la regla, que está pensado para quien cobra).
 */
export function useOperacion() {
  const { api, avisar } = useApi();
  const [ocupado, setOcupado] = useState(false);
  const ejecutar = useCallback(async (fn, exito) => {
    setOcupado(true);
    try {
      const r = await fn(api);
      if (exito) avisar('success', exito);
      return r ?? true;
    } catch (e) {
      avisar('danger', mensajeDeError(e, 'No se pudo completar la operación'));
      return null;
    } finally {
      setOcupado(false);
    }
  }, [api, avisar]);
  return { api, ejecutar, ocupado };
}

/** Búsqueda con espera de 250 ms entre teclas. */
export function useBusqueda(buscar, { minimo = 1 } = {}) {
  const [texto, setTexto] = useState('');
  const [items, setItems] = useState(null);
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    const t0 = texto.trim();
    if (t0.length < minimo) { setItems(null); return undefined; }
    let vivo = true;
    setCargando(true);
    const t = setTimeout(async () => {
      try {
        const r = await buscar(t0);
        if (vivo) setItems(r);
      } catch {
        if (vivo) setItems([]);
      } finally {
        if (vivo) setCargando(false);
      }
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [texto, buscar, minimo]);
  return { texto, setTexto, items, cargando };
}
