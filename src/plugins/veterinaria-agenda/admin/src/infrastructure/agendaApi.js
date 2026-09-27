/**
 * Infraestructura: el único sitio que sabe que los datos vienen por HTTP.
 *
 * Usa `useFetchClient` del panel, que adjunta el JWT de administrador. Por eso
 * las rutas del plugin son `type: 'admin'`: un token de admin no vale contra
 * la API de contenido.
 *
 * Devuelve datos ya desenvueltos, para que la capa de aplicación no tenga que
 * saber que Strapi envuelve todo en `{ data }`.
 */

const BASE = '/veterinaria-agenda';

export function crearAgendaApi(fetchClient) {
  return {
    async quienSoy() {
      const { data } = await fetchClient.get(`${BASE}/me`);
      return data;
    },

    async personal() {
      const { data } = await fetchClient.get(`${BASE}/staff`);
      return data.data;
    },

    async semana(desde, staffIds) {
      const query = new URLSearchParams({ desde });
      if (staffIds?.length) query.set('staff', staffIds.join(','));
      const { data } = await fetchClient.get(`${BASE}/week?${query}`);
      return data.data;
    },

    async cambiarEstado(documentId, estado) {
      const { data } = await fetchClient.put(`${BASE}/appointments/${documentId}/state`, { estado });
      return data.data;
    },

    async abrirConsulta(documentId) {
      const { data } = await fetchClient.post(`${BASE}/appointments/${documentId}/consultation`, {});
      return data.data;
    },
  };
}
