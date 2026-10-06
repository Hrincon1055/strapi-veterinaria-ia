/**
 * Entrada del lado admin. Módulo ES con export por defecto (no CommonJS): el
 * panel lo empaqueta con vite; en CommonJS falla con "default" is not
 * exported. Ver el mismo archivo del plugin de agenda.
 */
export { default } from './admin/src/index.jsx';
