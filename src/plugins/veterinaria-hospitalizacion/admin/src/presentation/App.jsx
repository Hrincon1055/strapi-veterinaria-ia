import * as React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Page } from '@strapi/strapi/admin';
import { TableroPage } from './paginas/TableroPage';
import { HojaPage } from './paginas/HojaPage';

/**
 * Páginas del módulo. El panel monta el plugin en `plugins/veterinaria-hospitalizacion/*`,
 * así que estas rutas son relativas a eso:
 *
 *   /        tablero: salas, jaulas y pacientes; ingreso
 *   /:id     hoja de evolución de una hospitalización (`?dia=AAAA-MM-DD`), órdenes, alta
 */
export function App() {
  return (
    <Routes>
      <Route index element={<TableroPage />} />
      <Route path=":id" element={<HojaPage />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  );
}

export default App;
