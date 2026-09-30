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

    async buscarMascotas(q) {
      const query = new URLSearchParams(q ? { q } : {});
      const { data } = await fetchClient.get(`${BASE}/pets?${query}`);
      return data.data;
    },

    /**
     * Reserva en un hueco. No se manda `endAt`: lo fija el servidor a partir
     * del hueco, para que el cliente no pueda estirar la cita sobre el tramo
     * siguiente.
     */
    async reservar({ staff, mascota, startAt, motivo, servicio }) {
      const { data } = await fetchClient.post(`${BASE}/appointments`, {
        staff, mascota, startAt, motivo, servicio,
      });
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

    /** `{ cita, puedeFinalizar }` de una consulta; `cita` es null si no viene de la agenda. */
    async atencion(consultaId) {
      const { data } = await fetchClient.get(`${BASE}/consultations/${consultaId}/attention`);
      return data.data;
    },

    /** `decision`: `{ servicio }` si la consulta aún no tiene servicio aplicado. */
    async finalizarAtencion(consultaId, decision = {}) {
      const { data } = await fetchClient.post(`${BASE}/consultations/${consultaId}/attention/finish`, decision);
      return data.data;
    },

    async servicios() {
      const { data } = await fetchClient.get(`${BASE}/services`);
      return data.data;
    },

    /** Consulta sin cita: registra el servicio de la visita. */
    async registrarServicio(consultaId, servicio) {
      const { data } = await fetchClient.post(`${BASE}/consultations/${consultaId}/attention/service`, { servicio });
      return data.data;
    },

    async reabrirAtencion(consultaId) {
      const { data } = await fetchClient.post(`${BASE}/consultations/${consultaId}/attention/reopen`, {});
      return data.data;
    },
  };
}
