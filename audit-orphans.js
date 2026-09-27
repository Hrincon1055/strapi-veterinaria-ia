'use strict';

/**
 * Busca duplicados y restos en la base de datos.
 *
 *   node audit-orphans.js
 *
 * Por qué existe: Strapi **no borra las tablas** de un content type o de un
 * componente que desaparece del código, y TypeScript incremental tampoco borra
 * su salida en `dist/`. Tras varias migraciones a componentes, lo que queda
 * atrás colisiona con lo nuevo y rompe la siguiente migración de formas que no
 * se ven venir.
 *
 * No adivina por el nombre de la tabla: arranca Strapi y compara contra
 * `strapi.db.metadata`, que es la lista real de tablas que Strapi gestiona,
 * incluidas las de enlace con nombre truncado y hasheado (Strapi acorta los
 * identificadores que exceden el límite, así que
 * `components_scheduling_consultation_services_performed_by_lnk` acaba siendo
 * `components_scheduling_consultatiobc665_performed_by_lnk`).
 */

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

let fallos = 0;
const mal = (m) => { console.log('  [!] ' + m); fallos++; };

/** Recorre un árbol de archivos. */
function walk(dir, cb) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, cb) : cb(p);
  }
}

(async () => {
  const app = await createStrapi({ appDir: process.cwd(), distDir: 'dist' }).load();

  // ---------- 1. duplicados en los esquemas ----------
  console.log('\n=== 1. NOMBRES DUPLICADOS ===');
  const usados = {};
  const registrar = (clave, valor, quien) => {
    ((usados[clave] ??= {})[valor] ??= []).push(quien);
  };

  for (const [uid, ct] of Object.entries(app.contentTypes)) {
    if (!uid.startsWith('api::')) continue;
    registrar('collectionName', ct.collectionName, uid);
    registrar('singularName', ct.info.singularName, uid);
    registrar('pluralName', ct.info.pluralName, uid);
  }
  for (const [uid, c] of Object.entries(app.components)) {
    registrar('collectionName', c.collectionName, uid);
  }

  let dup = 0;
  for (const [clave, valores] of Object.entries(usados)) {
    for (const [valor, quienes] of Object.entries(valores)) {
      if (quienes.length > 1) { mal(`${clave} "${valor}" repetido en: ${quienes.join(', ')}`); dup++; }
    }
  }
  if (dup === 0) {
    const nCt = Object.keys(app.contentTypes).filter((u) => u.startsWith('api::')).length;
    console.log(`  sin duplicados (${nCt} content types propios, ${Object.keys(app.components).length} componentes)`);
  }

  // ---------- 2. tablas que Strapi ya no gestiona ----------
  console.log('\n=== 2. TABLAS QUE STRAPI YA NO GESTIONA ===');

  // Todo lo que Strapi conoce: tablas base y tablas de unión (incluido el
  // nombre hasheado cuando el original era demasiado largo).
  const conocidas = new Set();
  for (const meta of app.db.metadata.values()) {
    if (meta.tableName) conocidas.add(meta.tableName);
    for (const attr of Object.values(meta.attributes ?? {})) {
      const jt = attr.joinTable;
      if (jt?.name) conocidas.add(jt.name);
      if (attr.morphColumn?.typeColumn) continue;
    }
  }
  // Las tablas polimórficas (_morph / _mph) no aparecen en joinTable.
  const esMorph = (t) => /_(morph|mph)$/.test(t);

  /**
   * Contabilidad interna de Strapi: no pertenece al modelo de contenido y por
   * eso no aparece en `db.metadata`. Tocarlas no es cosa de esta auditoría.
   */
  const CONTABILIDAD = new Set([
    'strapi_migrations',
    'strapi_migrations_internal',
    'strapi_database_schema',
  ]);

  // Strapi nombra el cliente `sqlite`/`postgres`/`mysql`, no como knex.
  const motor = String(app.db.connection.client.config.client ?? '');
  let enBase;
  if (/sqlite/i.test(motor)) {
    enBase = (
      await app.db.connection.raw(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      )
    ).map((r) => r.name);
  } else if (/pg|postgres/i.test(motor)) {
    enBase = (
      await app.db.connection.raw(
        'SELECT tablename AS name FROM pg_tables WHERE schemaname = current_schema()'
      )
    ).rows.map((r) => r.name);
  } else {
    const filas = await app.db.connection.raw('SHOW TABLES');
    enBase = filas[0].map((r) => Object.values(r)[0]);
  }

  const huerfanas = enBase.filter((t) => !conocidas.has(t) && !esMorph(t) && !CONTABILIDAD.has(t));

  if (huerfanas.length === 0) {
    console.log(`  ninguna (${enBase.length} tablas en la base, todas gestionadas)`);
  } else {
    for (const t of huerfanas) {
      const [{ c }] = await app.db.connection(t).count({ c: '*' });
      mal(`${t}  (${c} filas)  <- ningún content type ni componente la reclama`);
    }
    console.log('\n  Para eliminarlas: comprueba primero que su contenido esté migrado,');
    console.log('  luego DROP TABLE, vacía strapi_database_schema y reinicia.');
  }

  // ---------- 3. dist desincronizado ----------
  console.log('\n=== 3. ¿dist/ CONSERVA ALGO QUE YA NO ESTÁ EN src/? ===');
  let stale = 0;
  for (const base of ['dist/src/api', 'dist/src/components']) {
    walk(base, (p) => {
      if (!p.endsWith('.json') && !p.endsWith('.js')) return;
      const src = p.replace(/^dist[\\/]/, '').replace(/\.js$/, '.ts');
      const srcJson = p.replace(/^dist[\\/]/, '');
      if (!fs.existsSync(src) && !fs.existsSync(srcJson)) {
        mal(`${p} sobrevive en dist y ya no está en src  -> rm -rf dist`);
        stale++;
      }
    });
  }
  if (stale === 0) console.log('  dist coherente con src');

  await app.destroy();
  console.log(fallos === 0 ? '\nSIN PROBLEMAS\n' : `\n${fallos} PUNTOS A REVISAR\n`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => {
  console.error('la auditoría falló:', e.message);
  process.exit(2);
});
