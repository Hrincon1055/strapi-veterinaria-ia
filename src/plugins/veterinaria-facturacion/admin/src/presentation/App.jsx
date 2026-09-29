import * as React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Page } from '@strapi/strapi/admin';
import { InicioPage } from './paginas/InicioPage';
import { ConsultaPage } from './paginas/ConsultaPage';
import { FacturaPage } from './paginas/FacturaPage';

/**
 * Páginas del módulo. El panel monta el plugin en `plugins/veterinaria-facturacion/*`
 * (`addMenuLink` añade el `/*`), así que estas rutas son relativas a eso:
 *
 *   /                    bandeja (pendientes de cobro y facturas)
 *   /consultas/:id       qué se puede cobrar de una consulta → borrador
 *   /facturas/:id        detalle, edición del borrador, emisión, PDF, anulación
 */
export function App() {
  return (
    <Routes>
      <Route index element={<InicioPage />} />
      <Route path="consultas/:id" element={<ConsultaPage />} />
      <Route path="facturas/:id" element={<FacturaPage />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  );
}

export default App;
