import type { StrapiApp } from '@strapi/strapi/admin';

/**
 * Personalización del panel.
 *
 * `locales` solo HABILITA el español: cada administrador lo elige en su
 * perfil (arriba a la derecha → Perfil → Idioma de la interfaz) y la elección
 * se guarda en su navegador. El inglés sigue disponible porque Strapi no lo
 * puede quitar.
 *
 * Esto traduce la interfaz de Strapi (menús, botones, mensajes). Los nombres
 * de las colecciones salen del `info.displayName` de cada esquema y las
 * etiquetas de los campos de `src/bootstrap/etiquetas-es.json`.
 */
export default {
  config: {
    locales: ['es'],
  },
  bootstrap(_app: StrapiApp) {},
};
