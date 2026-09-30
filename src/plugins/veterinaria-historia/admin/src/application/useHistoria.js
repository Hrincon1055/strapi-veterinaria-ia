import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { crearHistoriaApi } from '../infrastructure/historiaApi';
import { mensajeDeError } from '../domain/formato';

/**
 * Aplicación: casos de uso del módulo. Los componentes llaman a estos hooks y
 * leen su estado; nunca hacen fetch.
 */

export function useApi() {
  const fetchClient = useFetchClient();
  return useMemo(() => crearHistoriaApi(fetchClient), [fetchClient]);
}

/** Carga genérica con estado de carga y error. `activa: false` no pide nada. */
function useCarga(cargar, deps, activa = true) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(activa);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activa) {
      setDatos(null);
      setCargando(false);
      return undefined;
    }
    let vivo = true;
    setCargando(true);
    setError(null);
    cargar()
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(mensajeDeError(e, 'No se pudieron cargar los datos')))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, activa]);

  return { datos, cargando, error };
}

/** Clientes que coinciden con el texto (nombre, documento o una mascota). */
export function useBusqueda(q) {
  const api = useApi();
  const [texto, setTexto] = useState(q);

  // Espera a que se deje de escribir: cada tecla no es una consulta.
  useEffect(() => {
    const t = setTimeout(() => setTexto(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const valido = texto.trim().length >= 2;
  return useCarga(() => api.buscarClientes(texto.trim()), [api, texto], valido);
}

/** Un cliente por documentId, para llegar desde su ficha. */
export function useCliente(documentId) {
  const api = useApi();
  return useCarga(() => api.cliente(documentId), [api, documentId], Boolean(documentId));
}

/** La historia completa de las mascotas elegidas. */
export function useHistoriaClinica({ mascotas, desde, hasta, orden }) {
  const api = useApi();
  const clave = mascotas.join(',');
  return useCarga(
    () => api.historia({ mascotas, desde, hasta, orden }),
    [api, clave, desde, hasta, orden],
    mascotas.length > 0
  );
}

/**
 * Imprime con el título del documento como nombre sugerido del PDF ("Guardar
 * como PDF" usa `document.title`). Lo devuelve a su valor al terminar.
 */
export function useImprimir() {
  return useCallback((titulo) => {
    const anterior = document.title;
    const restaurar = () => {
      document.title = anterior;
      window.removeEventListener('afterprint', restaurar);
    };
    window.addEventListener('afterprint', restaurar);
    document.title = titulo;
    window.print();
  }, []);
}
