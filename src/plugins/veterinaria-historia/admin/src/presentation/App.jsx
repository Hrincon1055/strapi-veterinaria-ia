import * as React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Page } from '@strapi/strapi/admin';
import { InicioPage } from './paginas/InicioPage';
import { HistoriaPage } from './paginas/HistoriaPage';
import { FormulaPage } from './paginas/FormulaPage';

/**
 * Páginas del módulo. El panel monta el plugin en `plugins/veterinaria-historia/*`,
 * así que estas rutas son relativas a eso:
 *
 *   /            elegir propietario y mascotas (`?cliente=` lo preselecciona)
 *   /imprimir    vista previa e impresión (`?mascotas=a,b&desde=&hasta=&orden=`)
 *   /formula/:id una fórmula médica, para imprimir en A5
 */
export function App() {
  return (
    <Routes>
      <Route index element={<InicioPage />} />
      <Route path="imprimir" element={<HistoriaPage />} />
      <Route path="formula/:id" element={<FormulaPage />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  );
}

export default App;
