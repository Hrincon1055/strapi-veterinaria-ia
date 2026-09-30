import { create } from 'zustand';

/**
 * Estado del módulo con Zustand.
 *
 * Guarda **intención**: qué se buscó, qué cliente y qué mascotas se eligieron.
 * Así, al abrir la historia y volver, la selección sigue donde estaba. Los
 * filtros de la historia (fechas, orden) viven en la URL de esa página, para
 * que un enlace o una recarga muestren lo mismo.
 */
export const useHistoriaStore = create((set) => ({
  q: '',
  cliente: null, // { documentId, nombre, documento, mascotas }
  elegidas: [], // documentIds de mascotas del cliente elegido

  setQ: (q) => set({ q }),

  /** Elegir un cliente marca todas sus mascotas: es el caso más común. */
  elegirCliente: (cliente) =>
    set({ cliente, elegidas: cliente ? cliente.mascotas.map((m) => m.documentId) : [] }),

  /**
   * Marcar una mascota de otro cliente cambia de cliente: una historia no
   * mezcla mascotas de dos propietarios (el servidor lo rechaza igual).
   */
  alternarMascota: (cliente, mascotaId) =>
    set((s) => {
      if (s.cliente?.documentId !== cliente.documentId) return { cliente, elegidas: [mascotaId] };
      const elegidas = s.elegidas.includes(mascotaId)
        ? s.elegidas.filter((id) => id !== mascotaId)
        : [...s.elegidas, mascotaId];
      return { elegidas };
    }),
}));
