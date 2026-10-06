import { Monitor } from '@strapi/icons';
import { PLUGIN_ID, RUTA_POS } from './presentation/rutas';

const accion = (a) => ({ action: `plugin::${PLUGIN_ID}.caja.${a}`, subject: null });

/**
 * Registro del plugin en el panel.
 *
 * El enlace del menú abre el punto de venta en otra pestaña (C12). El menú de
 * Strapi solo navega dentro del panel (React Router intercepta el clic), así
 * que se escucha el clic en fase de captura, antes que React, y se abre la
 * pestaña nosotros: es un clic del usuario, así que el navegador no lo
 * bloquea. Ctrl/Cmd + clic y el botón central siguen funcionando como
 * siempre. Si algo falla, la ruta base muestra un botón "Abrir punto de venta".
 */
function abrirEnOtraPestana(evento) {
  if (evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  const enlace = evento.target?.closest?.('a[href]');
  if (!enlace) return;
  const href = enlace.getAttribute('href') ?? '';
  if (!/\/plugins\/veterinaria-caja\/?$/.test(href)) return;
  evento.preventDefault();
  evento.stopPropagation();
  window.open(RUTA_POS, `${PLUGIN_ID}-pos`);
}

export default {
  register(app) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: Monitor,
      intlLabel: { id: `${PLUGIN_ID}.menu`, defaultMessage: 'Punto de venta' },
      permissions: ['operar', 'supervisar'].map(accion),
      Component: () => import('./presentation/App.jsx'),
    });
    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID });
  },

  bootstrap() {
    window.addEventListener('click', abrirEnOtraPestana, true);
  },
};
