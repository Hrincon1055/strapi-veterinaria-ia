/**
 * Infraestructura: el único sitio que sabe que los datos van por HTTP. Usa el
 * `fetchClient` del panel (lleva el token de la sesión de administrador) y
 * devuelve los datos ya desenvueltos de `{ data }`.
 */

const BASE = '/veterinaria-caja';

const consulta = (params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
};

export function crearCajaApi(fetchClient) {
  const get = async (ruta, params) => (await fetchClient.get(`${BASE}${ruta}${consulta(params)}`)).data;
  const post = async (ruta, cuerpo) => (await fetchClient.post(`${BASE}${ruta}`, cuerpo ?? {})).data;
  const datos = (p) => p.then((r) => r.data);

  return {
    quienSoy: () => get('/me'),
    cajas: () => datos(get('/registers')),
    abrir: (cuerpo) => datos(post('/sessions', cuerpo)),
    turno: (id) => datos(get(`/sessions/${id}`)),
    turnos: (filtros) => datos(get('/sessions', filtros)),
    cerrar: (id, cuerpo) => datos(post(`/sessions/${id}/close`, cuerpo)),

    catalogo: (filtros) => datos(get('/catalog', filtros)),
    buscarClientes: (q) => datos(get('/customers', { q })),
    crearCliente: (cuerpo) => datos(post('/customers', cuerpo)),
    cliente: (id) => datos(get(`/customers/${id}`)),
    origen: (tipo, id) => datos(get(`/origins/${tipo}/${id}`)),

    cobrar: (cuerpo) => datos(post('/charge', cuerpo)),
    abonar: (cuerpo) => datos(post('/payments', cuerpo)),
    anticipo: (cuerpo) => datos(post('/advances', cuerpo)),
    devolver: (cuerpo) => datos(post('/refunds', cuerpo)),
    reversar: (id, motivo) => datos(post(`/payments/${id}/reverse`, { motivo })),
    movimiento: (cuerpo) => datos(post('/movements', cuerpo)),

    factura: (id) => datos(get(`/invoices/${id}`)),
    buscarFactura: (numero) => datos(get('/invoices', { numero })),
    cartera: (q) => datos(get('/receivables', { q })),

    /** Soporte de un gasto: a la biblioteca de medios; devuelve el id del archivo. */
    async subirSoporte(archivo) {
      const form = new FormData();
      form.append('files', archivo);
      const r = await fetchClient.post('/upload', form);
      return r.data?.[0]?.id ?? null;
    },
  };
}
