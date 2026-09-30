import { Book } from '@strapi/icons';
import { PanelFicha } from './presentation/components/PanelFicha';

const PLUGIN_ID = 'veterinaria-historia';

/**
 * Registro del plugin en el panel.
 *
 * El menú exige `historia.ver`; los endpoints lo comprueban por su cuenta
 * (política `puede-ver-historia`): un menú oculto no es seguridad.
 */
export default {
  register(app) {
    app.addMenuLink({
      // Relativo, sin "/" inicial, y `Component` como import dinámico: las
      // otras formas funcionan pero Strapi las marca como obsoletas.
      to: `plugins/${PLUGIN_ID}`,
      icon: Book,
      intlLabel: { id: `${PLUGIN_ID}.menu`, defaultMessage: 'Historia clínica' },
      permissions: [{ action: `plugin::${PLUGIN_ID}.historia.ver`, subject: null }],
      Component: () => import('./presentation/App.jsx'),
    });

    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID });
  },

  bootstrap(app) {
    // Atajo a la historia desde la ficha de la mascota y la del cliente.
    app.getPlugin('content-manager').apis.addEditViewSidePanel([PanelFicha]);
  },
};
