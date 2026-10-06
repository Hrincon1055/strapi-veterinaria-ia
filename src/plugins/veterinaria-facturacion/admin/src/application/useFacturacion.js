import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { crearFacturacionApi } from '../infrastructure/facturacionApi';
import { useFacturacionStore } from '../presentation/store';
import { mensajeDeError } from '../domain/formato';

/**
 * Aplicación: casos de uso del módulo. Es la única capa que conoce a la vez
 * la API, el store y las notificaciones. Los componentes llaman a estas
 * acciones y leen su estado; nunca hacen fetch.
 *
 * Cada acción que escribe devuelve la factura actualizada que manda el
 * servidor (con totales ya recalculados) en vez de recalcular aquí: el
 * servidor es quien sabe.
 */

export function useApi() {
  const fetchClient = useFetchClient();
  const { toggleNotification } = useNotification();
  const api = useMemo(() => crearFacturacionApi(fetchClient), [fetchClient]);
  const avisar = useCallback((type, message) => toggleNotification({ type, message }), [toggleNotification]);
  return { api, avisar };
}

/** Carga genérica con estado de carga y error; `recargar` la repite. */
function useCarga(cargar, deps) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    cargar()
      .then((d) => vivo && setDatos(d))
      .catch((e) => vivo && setError(mensajeDeError(e, 'No se pudieron cargar los datos')))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, vuelta]);

  return { datos, setDatos, cargando, error, recargar: () => setVuelta((v) => v + 1) };
}

/** Qué puede hacer la cuenta. Se pide una vez y queda en el store. */
export function usePermisos() {
  const { api } = useApi();
  const { permisos, setPermisos } = useFacturacionStore();
  useEffect(() => {
    if (permisos) return;
    api.quienSoy().then(setPermisos).catch(() => setPermisos({ puedeVer: false }));
  }, [api, permisos, setPermisos]);
  return permisos;
}

export function usePendientes() {
  const { api } = useApi();
  const filtros = useFacturacionStore((s) => s.filtrosPendientes);
  return useCarga(() => api.pendientes(filtros), [api, filtros]);
}

export function useFacturas() {
  const { api } = useApi();
  const filtros = useFacturacionStore((s) => s.filtrosFacturas);
  return useCarga(() => api.facturas(filtros), [api, filtros]);
}

/**
 * Un origen (consulta u hospitalización): qué se puede cobrar y crear el
 * borrador con lo elegido.
 */
export function useConsulta(documentId, origen = 'consulta') {
  const { api, avisar } = useApi();
  const carga = useCarga(
    () => (origen === 'hospitalizacion' ? api.estadoHospitalizacion(documentId) : api.estadoConsulta(documentId)),
    [api, documentId, origen]
  );
  const [creando, setCreando] = useState(false);

  /** Devuelve el documentId del borrador creado, o null si falló. */
  const crearBorrador = useCallback(async (conceptos) => {
    setCreando(true);
    try {
      const f = await api.crear({ conceptos });
      avisar('success', 'Borrador creado');
      return f.documentId;
    } catch (e) {
      avisar('danger', mensajeDeError(e, 'No se pudo crear el borrador'));
      carga.recargar();
      return null;
    } finally {
      setCreando(false);
    }
  }, [api, avisar, carga]);

  return { ...carga, creando, crearBorrador };
}

/** Una factura y todo lo que se puede hacer con ella. */
export function useFactura(documentId) {
  const { api, avisar } = useApi();
  const carga = useCarga(() => api.factura(documentId), [api, documentId]);
  const [ocupado, setOcupado] = useState(false);

  /** Ejecuta una acción que devuelve la factura actualizada. */
  const accion = useCallback(async (fn, exito, fallo) => {
    setOcupado(true);
    try {
      const f = await fn();
      if (f) carga.setDatos(f);
      if (exito) avisar('success', exito);
      return true;
    } catch (e) {
      avisar('danger', mensajeDeError(e, fallo));
      return false;
    } finally {
      setOcupado(false);
    }
  }, [avisar, carga]);

  const id = documentId;
  return {
    ...carga,
    ocupado,
    guardarDatos: (cambios) => accion(() => api.actualizar(id, cambios), 'Borrador guardado', 'No se pudo guardar'),
    cambiarRenglon: (renglon, cambios) => accion(() => api.actualizarRenglon(id, renglon, cambios), null, 'No se pudo cambiar el renglón'),
    quitarRenglon: (renglon) => accion(() => api.quitarRenglon(id, renglon), 'Renglón quitado', 'No se pudo quitar el renglón'),
    agregarConceptos: (conceptos) => accion(() => api.agregar(id, { conceptos }), 'Conceptos añadidos', 'No se pudieron añadir'),
    agregarDirecto: (directo) => accion(() => api.agregar(id, { directo }), 'Concepto añadido', 'No se pudo añadir'),
    emitir: (venceEl) => accion(() => api.emitir(id, { venceEl }), 'Factura emitida', 'No se pudo emitir'),
    registrarPago: (estado) => accion(() => api.pago(id, estado), 'Pago registrado', 'No se pudo registrar el pago'),
    anular: (motivo) => accion(() => api.anular(id, motivo), 'Factura anulada; sus conceptos vuelven a estar pendientes', 'No se pudo anular'),
    borrar: async () => {
      try {
        await api.borrar(id);
        avisar('success', 'Borrador eliminado; sus conceptos vuelven a estar pendientes');
        return true;
      } catch (e) {
        avisar('danger', mensajeDeError(e, 'No se pudo borrar'));
        return false;
      }
    },
    /** Abre el PDF en otra pestaña o lo descarga. */
    pdf: async (descargar, nombre) => {
      try {
        const blob = await api.pdf(id);
        const url = URL.createObjectURL(blob);
        if (descargar) {
          const a = document.createElement('a');
          a.href = url;
          a.download = nombre;
          a.click();
        } else {
          window.open(url, '_blank', 'noopener');
        }
        // La pestaña ya tiene el documento; la URL se libera después.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (e) {
        avisar('danger', mensajeDeError(e, 'No se pudo generar el PDF'));
      }
    },
  };
}

/** Venta directa: buscar cliente y crear un borrador vacío. */
export function useVentaDirecta() {
  const { api, avisar } = useApi();
  const buscarClientes = useCallback((q) => api.buscarClientes(q), [api]);
  const crear = useCallback(async (cliente) => {
    try {
      const f = await api.crear({ cliente });
      return f.documentId;
    } catch (e) {
      avisar('danger', mensajeDeError(e, 'No se pudo crear la factura'));
      return null;
    }
  }, [api, avisar]);
  return { buscarClientes, crear };
}

/** Búsquedas para añadir conceptos a un borrador. */
export function useBusquedas() {
  const { api } = useApi();
  return {
    buscarCatalogo: useCallback((q) => api.buscarCatalogo(q), [api]),
    pendientesDelCliente: useCallback((cliente) => api.pendientes({ cliente }), [api]),
    estadoConsulta: useCallback((id) => api.estadoConsulta(id), [api]),
    estadoHospitalizacion: useCallback((id) => api.estadoHospitalizacion(id), [api]),
  };
}
