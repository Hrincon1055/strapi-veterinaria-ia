'use strict';

/**
 * Comprueba que strapi-veterinaria-prompt.md sigue describiendo el código real.
 *
 * El documento es la fuente de verdad del modelo, pero al llevar copias de los
 * esquemas se desincroniza en cuanto se toca un componente — basta cambiar un
 * icono. Este script lo detecta: compara cada bloque JSON con su archivo,
 * verifica que los componentes de cada dynamic zone estén documentados, que lo
 * que se eliminó no siga declarado, y que los totales cuadren.
 *
 *   node verify-model-doc.js
 */

const fs = require('fs');

const doc = fs.readFileSync('strapi-veterinaria-prompt.md', 'utf8');
let fallos = 0;
const mal = (m) => { console.log('  FALLO ' + m); fallos++; };

// --- 1. cada bloque JSON del documento coincide con su archivo -------------
const bloques = [
  ...doc.matchAll(/### `src\/components\/([a-z-]+\/[a-z-]+)\.json`[\s\S]*?```json\n([\s\S]*?)\n```/g),
];
console.log(`bloques de componente en el documento: ${bloques.length}`);

for (const [, ruta, json] of bloques) {
  const archivo = `src/components/${ruta}.json`;
  if (!fs.existsSync(archivo)) {
    mal(`el documento describe ${ruta}, que ya no existe`);
    continue;
  }
  if (JSON.stringify(JSON.parse(json)) !== JSON.stringify(JSON.parse(fs.readFileSync(archivo, 'utf8')))) {
    mal(`${ruta} difiere del archivo real`);
  }
}

// --- 2. las dynamic zones del código están documentadas --------------------
const ZONAS = [
  ['src/api/clinical/content-types/consultation/schema.json', 'sections'],
  ['src/api/travel/content-types/travel-case/schema.json', 'requirements'],
  ['src/api/marketing/content-types/campaign/schema.json', 'segment'],
];

for (const [archivo, campo] of ZONAS) {
  const attr = JSON.parse(fs.readFileSync(archivo, 'utf8')).attributes[campo];
  if (attr?.type !== 'dynamiczone') {
    mal(`${campo} ya no es una dynamic zone en ${archivo}`);
    continue;
  }
  const faltan = attr.components.filter((c) => !doc.includes(`"${c}"`));
  if (faltan.length > 0) mal(`sin documentar en la zona ${campo}: ${faltan.join(', ')}`);
  else console.log(`zona ${campo}: ${attr.components.length} componentes documentados`);
}

// --- 3. lo eliminado no sigue declarado ------------------------------------
// Una mención en prosa explicando un cambio es correcta; lo que no puede
// quedar es la DECLARACIÓN del content type.
if (doc.includes('#### `api::scheduling.consultation-service`')) {
  mal('el documento aún declara el content type consultation-service');
}
if (fs.existsSync('src/api/scheduling/content-types/consultation-service')) {
  mal('el content type consultation-service sigue en src/');
}
for (const campo of ['"anamnesis": { "type": "blocks" }', '"diagnosis": { "type": "blocks" }', '"treatmentNotes": { "type": "blocks" }']) {
  if (doc.includes(campo)) mal(`el documento todavía declara ${campo}`);
}
if (doc.includes('"segmentCriteria"')) mal('el documento todavía declara segmentCriteria');

// --- 4. los totales cuadran con los archivos en disco ----------------------
const componentes = fs.readdirSync('src/components')
  .flatMap((d) => fs.readdirSync(`src/components/${d}`)).length;

const contentTypes = (function contar(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += contar(`${dir}/${e.name}`);
    else if (e.name === 'schema.json') n++;
  }
  return n;
})('src/api');

const totales = doc.match(/\*\*(\d+) content types, (\d+) componentes/);
if (!totales) mal('no se encontró la línea de totales en el documento');
else {
  if (Number(totales[1]) !== contentTypes) mal(`el documento dice ${totales[1]} content types y hay ${contentTypes}`);
  if (Number(totales[2]) !== componentes) mal(`el documento dice ${totales[2]} componentes y hay ${componentes}`);
  if (Number(totales[1]) === contentTypes && Number(totales[2]) === componentes) {
    console.log(`totales: ${contentTypes} content types, ${componentes} componentes, coinciden`);
  }
}

console.log(fallos === 0 ? '\nDOCUMENTO COHERENTE CON EL CODIGO' : `\n${fallos} DESAJUSTES`);
process.exit(fallos === 0 ? 0 : 1);
