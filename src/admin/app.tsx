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

/**
 * Content types cuyo main field es `searchLabel` (los mismos que en
 * `MAIN_FIELDS` de `src/bootstrap/main-fields.ts`; el panel no puede
 * importarlo del servidor).
 */
const CON_ETIQUETA = [
  'api::identity.profile',
  'api::customer.customer',
  'api::pet.pet',
  'api::pet.breed',
  'api::clinical.consultation',
  'api::catalog.product',
  'api::billing.subscription',
  'api::billing.invoice',
  'api::shared.contact',
  'api::notification.notification-recipient',
  'api::marketing.campaign-metric',
];

const PREFIJO = 'STRAPI_LIST_VIEW_DISPLAYED_HEADERS:';

/**
 * Pone la columna `searchLabel` en la lista de esos content types.
 *
 * `main-fields.ts` ya la pone en la configuración del servidor, pero la lista
 * solo lee esa configuración la primera vez: después manda la copia que cada
 * navegador guarda en `localStorage` (`<PREFIJO><uid>:<uuid de la instancia>`,
 * content-manager `ListViewPage`). Se corrige esa copia al cargar el panel,
 * antes de que se monte ninguna lista.
 */
const mostrarEtiquetas = () => {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const clave = window.localStorage.key(i);
      if (!clave?.startsWith(PREFIJO)) continue;
      const uid = CON_ETIQUETA.find((u) => clave.startsWith(`${PREFIJO}${u}:`));
      if (!uid) continue;

      const columnas = JSON.parse(window.localStorage.getItem(clave) ?? 'null');
      if (!Array.isArray(columnas) || columnas.includes('searchLabel')) continue;

      const pos = columnas[0] === 'id' ? 1 : 0;
      columnas.splice(pos, 0, 'searchLabel');
      window.localStorage.setItem(clave, JSON.stringify(columnas));
    }
  } catch {
    // Sin localStorage (modo privado, bloqueado): la lista usa la del servidor.
  }
};

export default {
  config: {
    locales: ['es'],
  },
  bootstrap(_app: StrapiApp) {
    mostrarEtiquetas();
  },
};
