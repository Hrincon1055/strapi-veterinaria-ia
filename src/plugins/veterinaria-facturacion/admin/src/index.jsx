import { PriceTag } from '@strapi/icons';
import { PanelConsulta } from './presentation/components/PanelConsulta';

const PLUGIN_ID = 'veterinaria-facturacion';
const accion = (a) => ({ action: `plugin::${PLUGIN_ID}.facturacion.${a}`, subject: null });

/**
 * Registro del plugin en el panel.
 *
 * El menú se muestra con cualquiera de los cuatro permisos (los `permissions`
 * de `addMenuLink` se evalúan como OR). Los endpoints los comprueban por su
 * cuenta: un menú oculto no es seguridad.
 */
export default {
  register(app) {
    app.addMenuLink({
      // Relativo, sin "/" inicial, y `Component` como import dinámico: las
      // otras formas funcionan pero Strapi las marca como obsoletas.
      to: `plugins/${PLUGIN_ID}`,
      icon: PriceTag,
      intlLabel: { id: `${PLUGIN_ID}.menu`, defaultMessage: 'Facturación' },
      permissions: ['ver', 'preparar', 'emitir', 'anular'].map(accion),
      Component: () => import('./presentation/App.jsx'),
    });

    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID });
  },

  bootstrap(app) {
    // Resumen de facturación dentro de la ficha de la consulta.
    app.getPlugin('content-manager').apis.addEditViewSidePanel([PanelConsulta]);
  },
};
