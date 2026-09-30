/**
 * Infraestructura: el único sitio que sabe que los datos van por HTTP.
 *
 * Usa el `fetchClient` del panel, que adjunta el token de la sesión de
 * administrador; por eso las rutas del plugin son `type: 'admin'`. Devuelve
 * los datos ya desenvueltos de `{ data }`.
 */

const BASE = '/veterinaria-historia';

const consulta = (params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') q.set(k, Array.isArray(v) ? v.join(',') : v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
};

export function crearHistoriaApi(fetchClient) {
  const get = async (ruta, params) => (await fetchClient.get(`${BASE}${ruta}${consulta(params)}`)).data.data;

  return {
    buscarClientes: (q) => get('/customers', { q }),
    cliente: (id) => get(`/customers/${id}`),
    /** `{ mascotas: string[], desde?, hasta?, orden? }` */
    historia: (filtros) => get('/history', filtros),
  };
}
