'use strict';

/**
 * Comprueba que strapi-veterinaria-prompt.md sigue describiendo el codigo real.
 *
 * El documento es la fuente de verdad del modelo, pero al llevar copias de los
 * esquemas se desincroniza en cuanto se toca un componente. Este script lo
 * detecta: compara cada bloque JSON con su archivo, verifica que los siete
 * componentes de la dynamic zone esten documentados, que los campos viejos de
 * la consulta no se declaren ya, y que el total de componentes cuadre.
 *
 *   node verify-model-doc.js
 */

const fs = require('fs');
const doc = fs.readFileSync('strapi-veterinaria-prompt.md', 'utf8');
let fallos = 0;
const mal = (m) => { console.log('  FALLO ' + m); fallos++; };

// 1. los esquemas del documento coinciden byte a byte con los archivos reales
const bloques = [...doc.matchAll(/### `src\/components\/(clinical\/[a-z-]+)\.json`[\s\S]*?```json\n([\s\S]*?)\n```/g)];
console.log(`bloques de componente clínico en el documento: ${bloques.length}`);
for (const [, ruta, json] of bloques) {
  const real = fs.readFileSync(`src/components/${ruta}.json`, 'utf8');
  if (JSON.stringify(JSON.parse(json)) !== JSON.stringify(JSON.parse(real))) {
    mal(`${ruta} difiere del archivo real`);
  }
}

// 2. la zona documentada coincide con el esquema de consultation
const schema = JSON.parse(fs.readFileSync('src/api/clinical/content-types/consultation/schema.json', 'utf8'));
const real = schema.attributes.sections.components;
const documentados = real.filter((c) => doc.includes(`"${c}"`));
if (documentados.length !== real.length) {
  mal(`faltan en el documento: ${real.filter((c) => !documentados.includes(c)).join(', ')}`);
} else {
  console.log(`los ${real.length} componentes de la zona están en el documento`);
}
if (!doc.includes('"type": "dynamiczone"')) mal('el documento no declara la dynamic zone');

// 3. los campos viejos ya no se declaran como atributos
for (const campo of ['"anamnesis": { "type": "blocks" }', '"diagnosis": { "type": "blocks" }', '"treatmentNotes": { "type": "blocks" }']) {
  if (doc.includes(campo)) mal(`el documento todavía declara ${campo}`);
}
for (const campo of ['anamnesis', 'diagnosis', 'treatmentNotes']) {
  if (campo in schema.attributes) mal(`el esquema todavía tiene el atributo ${campo}`);
}

// 4. el total declarado coincide con los archivos en disco
const totalReal = fs.readdirSync('src/components').flatMap((d) => fs.readdirSync(`src/components/${d}`)).length;
const totalDoc = Number((doc.match(/\*\*32 content types, (\d+) componentes/) || [])[1]);
if (totalReal !== totalDoc) mal(`el documento dice ${totalDoc} componentes y hay ${totalReal}`);
else console.log(`total de componentes: ${totalReal}, coincide`);

console.log(fallos === 0 ? '\nDOCUMENTO COHERENTE CON EL CODIGO' : `\n${fallos} DESAJUSTES`);
process.exit(fallos === 0 ? 0 : 1);
