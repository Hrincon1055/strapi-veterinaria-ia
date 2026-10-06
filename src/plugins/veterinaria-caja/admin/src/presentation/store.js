import { create } from 'zustand';

let siguiente = 1;

/**
 * Estado del punto de venta con Zustand: el ticket en curso (líneas,
 * cliente, línea seleccionada y modo del teclado) y la navegación del
 * catálogo. Vive mientras la pestaña esté abierta; los datos del servidor
 * (turno, catálogo, cliente) los piden los hooks de `application/`.
 */
export const useCajaStore = create((set, get) => ({
  lineas: [],
  seleccionada: null,
  /** 'cantidad' | 'descuento': qué edita el teclado. */
  modo: 'cantidad',
  /** Lo que se va tecleando; se aplica a la línea seleccionada. */
  buffer: '',
  cliente: null, // { documentId, etiqueta, consumidorFinal }
  categoria: null,
  busqueda: '',

  setCliente: (cliente) => set({ cliente }),
  setCategoria: (categoria) => set({ categoria }),
  setBusqueda: (busqueda) => set({ busqueda }),
  setModo: (modo) => set({ modo, buffer: '' }),
  seleccionar: (clave) => set({ seleccionada: clave, buffer: '' }),

  /** Añade un producto o servicio; si ya está, suma uno. */
  agregarItem: (item) => {
    const existente = get().lineas.find((l) => l.tipo === 'catalogo' && l.documentId === item.documentId && l.relacion === item.relacion);
    if (existente) {
      set((s) => ({
        lineas: s.lineas.map((l) => (l.clave === existente.clave ? { ...l, cantidad: Number(l.cantidad) + 1 } : l)),
        seleccionada: existente.clave,
        buffer: '',
      }));
      return;
    }
    const clave = `l${siguiente++}`;
    set((s) => ({
      lineas: [...s.lineas, {
        clave, tipo: 'catalogo', relacion: item.relacion, documentId: item.documentId, nombre: item.nombre,
        unidad: item.unidad, precio: item.precio, iva: item.iva, cantidad: 1, descuentoPct: 0,
      }],
      seleccionada: clave,
      buffer: '',
    }));
  },

  /** Añade un concepto pendiente (de consulta u hospitalización); su cantidad no se cambia. */
  agregarConcepto: (c) => {
    if (get().lineas.some((l) => l.tipo === 'concepto' && l.lineKey === c.lineKey)) return;
    const clave = `l${siguiente++}`;
    set((s) => ({ lineas: [...s.lineas, { clave, tipo: 'concepto', descuentoPct: 0, ...c }], seleccionada: clave, buffer: '' }));
  },

  /** Tecla del teclado numérico sobre la línea seleccionada. */
  teclear: (tecla) => {
    const { seleccionada, lineas, modo, buffer } = get();
    const linea = lineas.find((l) => l.clave === seleccionada);
    if (!linea) return;
    if (tecla === 'borrar') {
      if (buffer === '' && modo === 'cantidad') {
        set((s) => ({ lineas: s.lineas.filter((l) => l.clave !== seleccionada), seleccionada: s.lineas.filter((l) => l.clave !== seleccionada).at(-1)?.clave ?? null }));
        return;
      }
      const nuevo = buffer.slice(0, -1);
      set({ buffer: nuevo });
      aplicar(nuevo === '' ? (modo === 'cantidad' ? '0' : '0') : nuevo);
      return;
    }
    if (tecla === '+/-') return;
    if (tecla === '.' && buffer.includes('.')) return;
    const nuevo = `${buffer}${tecla}`;
    set({ buffer: nuevo });
    aplicar(nuevo);

    function aplicar(valor) {
      const n = Number(valor);
      if (!Number.isFinite(n)) return;
      set((s) => ({
        lineas: s.lineas.map((l) => {
          if (l.clave !== seleccionada) return l;
          if (modo === 'descuento') return { ...l, descuentoPct: Math.min(100, Math.max(0, n)) };
          if (l.tipo === 'concepto') return l;
          return { ...l, cantidad: n };
        }),
      }));
    }
  },

  quitarLinea: (clave) => set((s) => ({ lineas: s.lineas.filter((l) => l.clave !== clave), seleccionada: null, buffer: '' })),
  vaciar: () => set({ lineas: [], seleccionada: null, buffer: '', cliente: null, modo: 'cantidad' }),
}));
