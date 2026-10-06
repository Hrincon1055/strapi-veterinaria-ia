import * as React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Page } from '@strapi/strapi/admin';
import { EntradaPage } from './paginas/EntradaPage';
import { PosPage } from './paginas/PosPage';

/**
 * Páginas del módulo, relativas a `plugins/veterinaria-caja/*`:
 *
 *   /        entrada (botón para abrir el POS en otra pestaña)
 *   /pos     el punto de venta a pantalla completa (`?factura=` abre un abono)
 */
export function App() {
  return (
    <Routes>
      <Route index element={<EntradaPage />} />
      <Route path="pos" element={<PosPage />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  );
}

export default App;
