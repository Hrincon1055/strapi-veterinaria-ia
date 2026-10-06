/**
 * Infraestructura: el único sitio que sabe que los datos van por HTTP.
 *
 * Usa el `fetchClient` del panel, que adjunta el token de la sesión de
 * administrador; por eso las rutas del plugin son `type: 'admin'`. Devuelve
 * los datos ya desenvueltos de `{ data }`.
 */

const BASE = '/veterinaria-facturacion';

const consulta = (params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
};

export function crearFacturacionApi(fetchClient) {
  const get = async (ruta, params) => (await fetchClient.get(`${BASE}${ruta}${consulta(params)}`)).data;
  const post = async (ruta, cuerpo) => (await fetchClient.post(`${BASE}${ruta}`, cuerpo ?? {})).data;
  const put = async (ruta, cuerpo) => (await fetchClient.put(`${BASE}${ruta}`, cuerpo ?? {})).data;
  const del = async (ruta) => (await fetchClient.del(`${BASE}${ruta}`)).data;

  return {
    quienSoy: () => get('/me'),

    pendientes: async (filtros) => (await get('/pending', filtros)).data,
    estadoConsulta: async (id) => (await get(`/consultations/${id}`)).data,
    estadoHospitalizacion: async (id) => (await get(`/hospitalizations/${id}`)).data,
    /** `{ data, paginacion }` */
    facturas: (filtros) => get('/invoices', filtros),
    factura: async (id) => (await get(`/invoices/${id}`)).data,

    buscarClientes: async (q) => (await get('/customers', { q })).data,
    buscarCatalogo: async (q) => (await get('/catalog', { q })).data,

    crear: async (cuerpo) => (await post('/invoices', cuerpo)).data,
    actualizar: async (id, cambios) => (await put(`/invoices/${id}`, cambios)).data,
    borrar: (id) => del(`/invoices/${id}`),
    agregar: async (id, cuerpo) => (await post(`/invoices/${id}/items`, cuerpo)).data,
    actualizarRenglon: async (id, renglon, cambios) => (await put(`/invoices/${id}/items/${renglon}`, cambios)).data,
    quitarRenglon: async (id, renglon) => (await del(`/invoices/${id}/items/${renglon}`)).data,

    emitir: async (id, cuerpo) => (await post(`/invoices/${id}/issue`, cuerpo)).data,
    anular: async (id, motivo) => (await post(`/invoices/${id}/void`, { motivo })).data,

    /**
     * El PDF como Blob. No sirve un enlace directo: la ruta exige el token de
     * la sesión, que va en una cabecera, no en la URL.
     */
    pdf: async (id) => (await fetchClient.get(`${BASE}/invoices/${id}/pdf`, { responseType: 'blob' })).data,
  };
}
