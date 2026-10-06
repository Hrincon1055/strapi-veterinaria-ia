import { createElement, useEffect, useState, type ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { getFetchClient, type StrapiApp } from '@strapi/strapi/admin';

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
  'api::clinical.prescription',
  'api::catalog.product',
  'api::billing.subscription',
  'api::billing.invoice',
  'api::shared.contact',
  'api::notification.notification-recipient',
  'api::marketing.campaign-metric',
  'api::hospitalization.hospitalization',
  'api::hospitalization.treatment-order',
  'api::cash.cash-session',
  'api::cash.payment',
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

/**
 * Botón "CSV/Excel" de `strapi-plugin-collection-exporter`: solo se pinta en
 * las colecciones que esta cuenta puede exportar.
 *
 * El plugin lo inyecta en la lista de TODAS las colecciones. Quien decide qué
 * se exporta es el servidor (`src/extensions/collection-exporter/`), y
 * `/collection-exporter/content-types` devuelve ya filtrado por catálogo y
 * por rol; se pregunta una vez por carga del panel. Ocultarlo es comodidad,
 * no protección: las rutas responden 403 igualmente.
 */
const BOTON_EXPORTAR = 'collection-exporter.view-data-button';

let exportables: Promise<Set<string>> | null = null;
const cargarExportables = () =>
  (exportables ??= getFetchClient()
    .get<{ uid: string }[]>('/collection-exporter/content-types')
    .then(({ data }) => new Set<string>((data ?? []).map((t) => t.uid)))
    .catch(() => {
      exportables = null; // reintenta en la siguiente lista
      return new Set<string>();
    }));

const soloExportables = (Boton: ComponentType) => () => {
  const { pathname } = useLocation();
  const partes = pathname.split('/');
  const i = partes.indexOf('collection-types');
  const uid = i === -1 ? null : partes[i + 1];
  const [permitidos, setPermitidos] = useState<Set<string> | null>(null);

  useEffect(() => {
    let vivo = true;
    cargarExportables().then((s) => vivo && setPermitidos(s));
    return () => {
      vivo = false;
    };
  }, []);

  return uid && permitidos?.has(uid) ? createElement(Boton) : null;
};

const restringirExportador = (app: StrapiApp) => {
  const acciones: { name: string; Component: ComponentType }[] | undefined = (
    app.getPlugin('content-manager') as any
  )?.injectionZones?.listView?.actions;
  const boton = acciones?.find((a) => a.name === BOTON_EXPORTAR);
  if (boton) boton.Component = soloExportables(boton.Component);
};

export default {
  config: {
    locales: ['es'],
  },
  // Corre después del `bootstrap` de los plugins, así que el botón ya está inyectado.
  bootstrap(app: StrapiApp) {
    mostrarEtiquetas();
    restringirExportador(app);
  },
};
