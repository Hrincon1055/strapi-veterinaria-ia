import { create } from 'zustand';
import { hoy, lunesDe, sumarDias } from '../domain/semana';

/**
 * Estado de la agenda con Zustand.
 *
 * El store guarda **intención** (qué semana, qué personal, qué vista) y el
 * resultado ya cargado. No sabe pedir datos: eso lo hace el caso de uso, que
 * le inyecta el repositorio. Así el store se puede leer sin entender el
 * transporte, y cambiar de transporte no lo toca.
 */
export const useAgendaStore = create((set, get) => ({
  // --- intención ---
  lunes: lunesDe(hoy()),
  vista: 'personal', // 'personal' | 'general'
  seleccion: [],     // documentIds del personal visible

  // --- datos ---
  yo: null,
  personal: [],
  semana: null,

  // --- estado de carga ---
  cargando: false,
  error: null,

  irASemana: (lunes) => set({ lunes }),
  semanaAnterior: () => set({ lunes: sumarDias(get().lunes, -7) }),
  semanaSiguiente: () => set({ lunes: sumarDias(get().lunes, 7) }),
  semanaActual: () => set({ lunes: lunesDe(hoy()) }),

  setVista: (vista) => {
    const { yo, personal } = get();
    // Al volver a "mi agenda" la selección se reduce a uno mismo; si no,
    // quedaría mostrando a otros bajo un rótulo que dice "personal".
    const seleccion =
      vista === 'personal'
        ? [yo?.staffDocumentId].filter(Boolean)
        : personal.map((s) => s.documentId);
    set({ vista, seleccion });
  },

  alternarStaff: (documentId) => {
    const actual = get().seleccion;
    const nueva = actual.includes(documentId)
      ? actual.filter((x) => x !== documentId)
      : [...actual, documentId];
    set({ seleccion: nueva });
  },

  setEstadoCarga: (cargando, error = null) => set({ cargando, error }),
  setContexto: ({ yo, personal, seleccion }) => set({ yo, personal, seleccion }),
  setSemana: (semana) => set({ semana }),

  /**
   * Mete una cita recién reservada en su columna y **quita el hueco que
   * acaba de ocupar**.
   *
   * Lo segundo importa tanto como lo primero: los huecos no son registros,
   * son el resultado de restar las citas al horario. Si se añade la cita sin
   * quitar el hueco, la rejilla enseña las dos cosas encima y parece que el
   * tramo sigue libre.
   */
  agregarCita: (staffDocumentId, cita) =>
    set((s) => {
      if (!s.semana) return s;
      const inicio = String(cita.startAt).replace(/Z$/, '');
      return {
        semana: {
          ...s.semana,
          columnas: s.semana.columnas.map((col) =>
            col.staff.documentId !== staffDocumentId
              ? col
              : {
                  ...col,
                  citas: [...col.citas, cita].sort((a, b) => String(a.startAt).localeCompare(String(b.startAt))),
                  dias: (col.dias ?? []).map((d) => {
                    const huecos = (d.huecos ?? []).filter(
                      (h) => String(h.startAt).replace(/Z$/, '') !== inicio
                    );
                    if (huecos.length === (d.huecos ?? []).length) return d;
                    return { ...d, huecos, libres: Math.max(0, (d.libres ?? 0) - 1), ocupados: (d.ocupados ?? 0) + 1 };
                  }),
                }
          ),
        },
      };
    }),

  /** Actualiza una cita en sitio, sin recargar toda la semana. */
  actualizarCita: (documentId, cambios) =>
    set((s) => {
      if (!s.semana) return s;
      return {
        semana: {
          ...s.semana,
          columnas: s.semana.columnas.map((col) => ({
            ...col,
            citas: col.citas.map((c) => (c.documentId === documentId ? { ...c, ...cambios } : c)),
          })),
        },
      };
    }),
}));
