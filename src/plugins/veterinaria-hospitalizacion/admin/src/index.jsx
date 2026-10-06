import { Stethoscope } from '@strapi/icons';
import { PanelHospitalizacion } from './presentation/components/PanelHospitalizacion';

const PLUGIN_ID = 'veterinaria-hospitalizacion';
const accion = (a) => ({ action: `plugin::${PLUGIN_ID}.hospitalizacion.${a}`, subject: null });

/**
 * Registro del plugin en el panel.
 *
 * El menú se muestra con cualquiera de los tres permisos (los `permissions`
 * de `addMenuLink` se evalúan como OR). Los endpoints los comprueban por su
 * cuenta: un menú oculto no es seguridad.
 */
export default {
  register(app) {
    app.addMenuLink({
      // Relativo, sin "/" inicial, y `Component` como import dinámico: las
      // otras formas funcionan pero Strapi las marca como obsoletas.
      to: `plugins/${PLUGIN_ID}`,
      icon: Stethoscope,
      intlLabel: { id: `${PLUGIN_ID}.menu`, defaultMessage: 'Hospitalización' },
      permissions: ['ver', 'registrar', 'prescribir'].map(accion),
      Component: () => import('./presentation/App.jsx'),
    });

    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID });
  },

  bootstrap(app) {
    // Dónde está ingresada la mascota, desde su ficha y desde la consulta.
    app.getPlugin('content-manager').apis.addEditViewSidePanel([PanelHospitalizacion]);
  },
};
