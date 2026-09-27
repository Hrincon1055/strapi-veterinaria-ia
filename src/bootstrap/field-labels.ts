import type { Core } from '@strapi/strapi';

import etiquetas from './etiquetas-es.json';

/**
 * Pone en español la etiqueta de cada campo en el panel (formulario y
 * cabecera de columna del listado).
 *
 * Esas etiquetas no están en el schema.json: son configuración del Content
 * Manager y viven en el mismo almacén que usa `main-fields.ts`
 * (`plugin_content_manager_configuration_{content_types,components}::<uid>`).
 * Por eso no basta con editar el esquema, y por eso se aplican aquí.
 *
 * Las traducciones están en `etiquetas-es.json`: `tipos[uid][campo]` manda
 * sobre `comunes[campo]`, que cubre los nombres que se repiten (name, notes,
 * pet, state…). Los componentes van por su uid sin prefijo
 * (`clinical.anamnesis`).
 *
 * Solo sustituye la etiqueta mientras siga siendo la de fábrica, que Strapi
 * pone igual al nombre del campo (`label: name` en content-manager
 * `.../configuration/metadatas.js`). Una etiqueta cambiada a mano en
 * "Configurar la vista" sobrevive al reinicio — y, por la misma razón,
 * corregir aquí una traducción ya aplicada no la reescribe: hay que cambiarla
 * también en el panel.
 */

const tipos = etiquetas.tipos as Record<string, Record<string, string>>;
const comunes = etiquetas.comunes as Record<string, string>;

const traducir = (uid: string, campo: string): string | undefined =>
  tipos[uid]?.[campo] ?? comunes[campo];

export default async (strapi: Core.Strapi): Promise<void> => {
  const store = strapi.store({ type: 'plugin', name: 'content_manager_configuration' });

  const destinos = [
    ...Object.keys(strapi.contentTypes)
      .filter((uid) => uid.startsWith('api::') || uid === 'plugin::users-permissions.user')
      .map((uid) => ({ uid, key: `content_types::${uid}` })),
    ...Object.keys(strapi.components).map((uid) => ({ uid, key: `components::${uid}` })),
  ];

  let cambios = 0;
  const sinTraducir: string[] = [];

  for (const { uid, key } of destinos) {
    const config: any = await store.get({ key });
    if (!config?.metadatas) continue;

    let tocado = false;
    for (const [campo, meta] of Object.entries<any>(config.metadatas)) {
      const es = traducir(uid, campo);
      if (!es) {
        sinTraducir.push(`${uid}.${campo}`);
        continue;
      }
      for (const vista of ['edit', 'list'] as const) {
        if (meta?.[vista] && meta[vista].label === campo) {
          meta[vista].label = es;
          tocado = true;
        }
      }
    }

    if (tocado) {
      await store.set({ key, value: config });
      cambios++;
    }
  }

  if (cambios > 0) {
    strapi.log.info(`[field-labels] etiquetas en español aplicadas en ${cambios} configuraciones del panel`);
  }
  if (sinTraducir.length > 0) {
    strapi.log.warn(`[field-labels] campos sin traducción en etiquetas-es.json: ${sinTraducir.join(', ')}`);
  }
};
