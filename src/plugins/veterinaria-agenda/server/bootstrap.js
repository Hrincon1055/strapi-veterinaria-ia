'use strict';

/**
 * Permisos propios de la agenda.
 *
 * `registerMany` SOLO se puede llamar desde bootstrap: fuera de aquí lanza
 * "You can't register new actions outside of the bootstrap function".
 *
 * Se registran tres acciones porque son tres cosas distintas que el negocio
 * reparte de otra manera: el profesional ve su agenda; recepción ve la de
 * todos; y reservar en un hueco libre es de recepción, no del veterinario,
 * que solo atiende lo que ya tiene agendado. Quien no tenga `ver-todas` queda
 * forzado a la suya, lo decida o no la interfaz; quien no tenga `agendar` no
 * puede crear citas aunque llame al endpoint a mano.
 *
 * Y aquí acaba el trabajo: **no se asignan a ningún rol desde código**. El
 * Super Admin las recibe solo —Strapi le concede toda acción registrada al
 * arrancar— y el resto se conceden desde Ajustes → Roles. Intentar asignarlas
 * a mano con `assignPermissions` rompía el arranque con
 * "[45] is not an existing permission action", porque ese método REEMPLAZA la
 * lista completa y hay que reenviar permisos que quizá ya no existan.
 */
const ACCIONES = [
  {
    uid: 'agenda.ver-propia',
    displayName: 'Ver su propia agenda',
    pluginName: 'veterinaria-agenda',
    section: 'plugins',
  },
  {
    uid: 'agenda.ver-todas',
    displayName: 'Ver la agenda de todo el personal',
    pluginName: 'veterinaria-agenda',
    section: 'plugins',
  },
  {
    uid: 'agenda.agendar',
    displayName: 'Reservar citas en los huecos libres',
    pluginName: 'veterinaria-agenda',
    section: 'plugins',
  },
];

module.exports = async ({ strapi }) => {
  await strapi.service('admin::permission').actionProvider.registerMany(ACCIONES);
};
