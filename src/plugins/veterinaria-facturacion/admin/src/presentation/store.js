import { create } from 'zustand';
import { haceDias, hoy } from '../domain/formato';

/**
 * Estado del módulo con Zustand.
 *
 * Guarda **intención**: qué pestaña, qué filtros, qué página. Así, al abrir
 * una factura y volver, la bandeja sigue donde estaba. Los datos cargados
 * viven en los hooks de `application/`, que saben pedirlos; el store no.
 */
export const useFacturacionStore = create((set) => ({
  permisos: null,
  pestana: 'pendientes', // 'pendientes' | 'facturas'

  filtrosPendientes: { desde: haceDias(30), hasta: hoy() },
  filtrosFacturas: { estado: '', pago: '', desde: '', hasta: '', q: '', page: 1 },

  setPermisos: (permisos) => set({ permisos }),
  setPestana: (pestana) => set({ pestana }),
  setFiltrosPendientes: (cambios) => set((s) => ({ filtrosPendientes: { ...s.filtrosPendientes, ...cambios } })),
  /** Cambiar un filtro vuelve a la primera página; cambiar de página, no. */
  setFiltrosFacturas: (cambios) =>
    set((s) => ({ filtrosFacturas: { ...s.filtrosFacturas, ...cambios, page: cambios.page ?? 1 } })),
}));
