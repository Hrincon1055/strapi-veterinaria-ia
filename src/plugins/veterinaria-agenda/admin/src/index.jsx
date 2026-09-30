import { Calendar } from '@strapi/icons';

import { AgendaPage } from './presentation/AgendaPage';
import { PanelAtencion } from './presentation/components/PanelAtencion';

const PLUGIN_ID = 'veterinaria-agenda';

/**
 * Registro del plugin en el panel.
 *
 * El enlace del menú se declara con los permisos de la agenda: quien no los
 * tenga no lo ve. Aun así, los endpoints los comprueban por su cuenta — un
 * menú oculto no es seguridad.
 */
export default {
  register(app) {
    app.addMenuLink({
      to: `/plugins/${PLUGIN_ID}`,
      // Tiene que ser el componente, no una llamada ni una función que
      // devuelva null: el menú lo renderiza él mismo. Con `() => null` el
      // enlace sale solo con el texto, desalineado respecto a los demás.
      icon: Calendar,
      intlLabel: { id: `${PLUGIN_ID}.menu`, defaultMessage: 'Agenda' },
      permissions: [
        { action: `plugin::${PLUGIN_ID}.agenda.ver-propia`, subject: null },
        { action: `plugin::${PLUGIN_ID}.agenda.ver-todas`, subject: null },
        { action: `plugin::${PLUGIN_ID}.agenda.agendar`, subject: null },
      ],
      Component: async () => ({ default: AgendaPage }),
    });

    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID });
  },

  bootstrap(app) {
    // "Finalizar atención" dentro de la ficha de la consulta: el veterinario
    // cierra la cita donde está trabajando, sin volver a la agenda.
    app.getPlugin('content-manager').apis.addEditViewSidePanel([PanelAtencion]);
  },
};
