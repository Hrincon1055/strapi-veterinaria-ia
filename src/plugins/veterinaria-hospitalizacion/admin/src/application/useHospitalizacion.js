import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { crearHospitalizacionApi } from '../infrastructure/hospitalizacionApi';
import { useHospitalizacionStore } from '../presentation/store';
import { mensajeDeError } from '../domain/formato';

/**
 * Aplicación: casos de uso del módulo. Es la única capa que conoce a la vez
 * la API, el store y las notificaciones. Los componentes llaman a estas
 * acciones y leen su estado; nunca hacen fetch.
 *
 * Tras cada escritura se vuelve a pedir la hoja al servidor en vez de
 * recalcular aquí: las tomas programadas, los atrasos y lo que permite cada
 * regla son del servidor.
 */

export function useApi() {
  const fetchClient = useFetchClient();
  const { toggleNotification } = useNotification();
  const api = useMemo(() => crearHospitalizacionApi(fetchClient), [fetchClient]);
  const avisar = useCallback((type, message) => toggleNotification({ type, message }), [toggleNotification]);
  return { api, avisar };
}

/** Carga genérica con estado de carga y error; `recargar` la repite sin parpadeo. */
function useCarga(cargar, deps) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vivo = true;
    if (vuelta === 0) setCargando(true);
    setError(null);
    cargar()
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(mensajeDeError(e, 'No se pudieron cargar los datos')))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, vuelta]);

  return { datos, cargando, error, recargar: useCallback(() => setVuelta((v) => v + 1), []) };
}

/** Qué puede hacer la cuenta y si la clínica hospitaliza. Se pide una vez. */
export function usePermisos() {
  const { api } = useApi();
  const { permisos, setPermisos } = useHospitalizacionStore();
  useEffect(() => {
    if (permisos) return;
    api.quienSoy().then(setPermisos).catch(() => setPermisos({ puedeVer: false, habilitada: false }));
  }, [api, permisos, setPermisos]);
  return permisos;
}

/** Repite `fn` cada `ms` mientras la pestaña está visible: la sala cambia sola. */
function useRefresco(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') ref.current();
    }, ms);
    return () => clearInterval(t);
  }, [ms]);
}

export function useTablero() {
  const { api } = useApi();
  const carga = useCarga(() => api.tablero(), [api]);
  useRefresco(carga.recargar, 60_000);
  return carga;
}

/**
 * La hoja de un día y todo lo que se puede hacer en ella. Cada acción
 * devuelve true si salió bien (para cerrar el modal) y recarga la hoja.
 */
export function useHoja(documentId, dia) {
  const { api, avisar } = useApi();
  const carga = useCarga(() => api.hoja(documentId, dia), [api, documentId, dia]);
  const [ocupado, setOcupado] = useState(false);
  useRefresco(carga.recargar, 60_000);

  const accion = useCallback(async (fn, exito, fallo) => {
    setOcupado(true);
    try {
      await fn();
      if (exito) avisar('success', exito);
      carga.recargar();
      return true;
    } catch (e) {
      avisar('danger', mensajeDeError(e, fallo));
      return false;
    } finally {
      setOcupado(false);
    }
  }, [avisar, carga]);

  const id = documentId;
  const diaDeLaHoja = carga.datos?.dia;
  return {
    ...carga,
    ocupado,
    registrarSignos: (datos) => accion(() => api.signos(id, { ...datos, dia: diaDeLaHoja }), 'Signos registrados', 'No se pudieron registrar los signos'),
    registrarToma: (datos) => accion(() => api.toma(id, { ...datos, dia: diaDeLaHoja }),
      datos.estado === 'omitted' ? 'Toma registrada como omitida' : 'Toma registrada', 'No se pudo registrar la toma'),
    prescribir: (datos) => accion(() => api.prescribir(id, datos), 'Orden de tratamiento añadida', 'No se pudo añadir la orden'),
    suspender: (orden, motivo) => accion(() => api.suspender(orden, motivo), 'Orden suspendida', 'No se pudo suspender la orden'),
    trasladar: (jaula) => accion(() => api.trasladar(id, jaula), 'Paciente trasladado', 'No se pudo trasladar'),
    darAlta: (datos) => accion(() => api.alta(id, datos), 'Alta registrada', 'No se pudo dar el alta'),
  };
}

/** Ingreso: devuelve el documentId de la hospitalización creada, o null. */
export function useIngreso() {
  const { api, avisar } = useApi();
  const [ocupado, setOcupado] = useState(false);
  const ingresar = useCallback(async (datos) => {
    setOcupado(true);
    try {
      const h = await api.ingresar(datos);
      avisar('success', 'Paciente ingresado');
      return h.documentId;
    } catch (e) {
      avisar('danger', mensajeDeError(e, 'No se pudo ingresar al paciente'));
      return null;
    } finally {
      setOcupado(false);
    }
  }, [api, avisar]);
  return { ingresar, ocupado };
}

/** Búsquedas para los formularios. */
export function useBusquedas() {
  const { api } = useApi();
  return useMemo(() => ({
    mascotas: (q) => api.buscarMascotas(q),
    jaulasLibres: () => api.jaulasLibres(),
    veterinarios: () => api.veterinarios(),
    productos: (q) => api.productos(q),
  }), [api]);
}

/** Búsqueda con espera de 250 ms entre teclas. */
export function useBusqueda(buscar, { minimo = 2 } = {}) {
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
