/**
 * Ruta propia para buscar dentro de la historia clínica.
 *
 * Va en su propio archivo y no en el router de factoría porque
 * `createCoreRouter` solo genera las cinco acciones estándar; cualquier
 * endpoint adicional se declara aparte.
 *
 * El orden de carga importa: esta ruta tiene que quedar antes que
 * `GET /consultations/:id`, o `search` se interpretaría como un documentId.
 * Strapi carga los routers personalizados antes que los de factoría, así que
 * con tenerla en un archivo propio basta.
 *
 * Lleva la misma policy de propiedad que el resto: un cliente solo busca en su
 * propia historia. El permiso `api::clinical.consultation.searchBySection` se
 * concede en src/bootstrap/roles.ts.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/consultations/search',
      // Handler completo y no relativo: la policy is-owner deduce el content type
      // del handler (handler.split('.').slice(0,2)), y 'consultation.searchBySection'
      // no le diria a que UID pertenece.
      handler: 'api::clinical.consultation.searchBySection',
      config: {
        policies: ['global::is-owner'],
      },
    },
  ],
};
