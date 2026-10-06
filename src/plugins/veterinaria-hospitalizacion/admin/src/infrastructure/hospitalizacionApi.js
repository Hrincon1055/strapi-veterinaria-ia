/**
 * Infraestructura: el único sitio que sabe que los datos van por HTTP.
 *
 * Usa el `fetchClient` del panel, que adjunta el token de la sesión de
 * administrador; por eso las rutas del plugin son `type: 'admin'`. Devuelve
 * los datos ya desenvueltos de `{ data }`.
 */

const BASE = '/veterinaria-hospitalizacion';

const consulta = (params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
};

export function crearHospitalizacionApi(fetchClient) {
  const get = async (ruta, params) => (await fetchClient.get(`${BASE}${ruta}${consulta(params)}`)).data;
  const post = async (ruta, cuerpo) => (await fetchClient.post(`${BASE}${ruta}`, cuerpo ?? {})).data;

  return {
    quienSoy: () => get('/me'),
    tablero: async () => (await get('/board')).data,
    hoja: async (id, dia) => (await get(`/hospitalizations/${id}`, { dia })).data,
    deMascota: async (id) => (await get(`/pets/${id}`)).data,
    deConsulta: async (id) => (await get(`/consultations/${id}`)).data,

    buscarMascotas: async (q) => (await get('/search/pets', { q })).data,
    jaulasLibres: async () => (await get('/search/cages')).data,
    veterinarios: async () => (await get('/search/vets')).data,
    productos: async (q) => (await get('/search/products', { q })).data,

    ingresar: async (cuerpo) => (await post('/hospitalizations', cuerpo)).data,
    prescribir: async (id, cuerpo) => (await post(`/hospitalizations/${id}/orders`, cuerpo)).data,
    suspender: async (orden, motivo) => (await post(`/orders/${orden}/suspend`, { motivo })).data,
    signos: async (id, cuerpo) => (await post(`/hospitalizations/${id}/vitals`, cuerpo)).data,
    toma: async (id, cuerpo) => (await post(`/hospitalizations/${id}/administrations`, cuerpo)).data,
    trasladar: async (id, jaula) => (await post(`/hospitalizations/${id}/transfer`, { jaula })).data,
    alta: async (id, cuerpo) => (await post(`/hospitalizations/${id}/discharge`, cuerpo)).data,
  };
}
