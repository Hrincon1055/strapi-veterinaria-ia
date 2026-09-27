/**
 * Entrada del lado admin.
 *
 * Módulo ES con export por defecto, no CommonJS: el panel lo empaqueta con
 * rollup/vite y lo importa como `import plugin from '.../strapi-admin'`.
 * El lado servidor (`strapi-server.js`) sí es CommonJS, porque lo carga Node.
 */
export { default } from './admin/src/index.jsx';
