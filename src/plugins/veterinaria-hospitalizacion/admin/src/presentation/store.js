import { create } from 'zustand';

/**
 * Estado del módulo con Zustand.
 *
 * Guarda lo que la cuenta puede hacer (se pide una vez) y preferencias de
 * vista que conviene recordar al ir del tablero a una hoja y volver. Los
 * datos cargados viven en los hooks de `application/`, que saben pedirlos.
 */
export const useHospitalizacionStore = create((set) => ({
  permisos: null,
  /** Tablero: ocultar las jaulas desactivadas. */
  soloActivas: true,
  /** Hoja: mostrar también las órdenes ya suspendidas o terminadas. */
  verOrdenesCerradas: false,

  setPermisos: (permisos) => set({ permisos }),
  setSoloActivas: (soloActivas) => set({ soloActivas }),
  setVerOrdenesCerradas: (verOrdenesCerradas) => set({ verOrdenesCerradas }),
}));
