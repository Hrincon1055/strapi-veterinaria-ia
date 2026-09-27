/**
 * Huecos libres de un profesional.
 *
 * Router propio porque no opera sobre un content type: cruza horario,
 * excepciones y citas para calcular algo que no está almacenado.
 *
 * Sin policy de propiedad: un cliente necesita ver los huecos del veterinario
 * para poder reservar en línea, y un hueco libre no es dato de nadie. Lo que
 * NO expone es de quién es cada cita ocupada — solo que ese tramo no está.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/availability',
      handler: 'api::scheduling.availability.find',
      config: {
        middlewares: ['global::date-range'],
      },
    },
  ],
};
