import * as React from 'react';
import { createPortal } from 'react-dom';
import { ThemeProvider, createGlobalStyle } from 'styled-components';
import { lightTheme } from '@strapi/design-system';

/**
 * Lo que sale en papel (copia del componente de `veterinaria-historia`, con
 * sus propias clases `vho-*` para que los dos no se pisen).
 *
 * El documento no se imprime desde la página: el panel de Strapi pone la
 * navegación, la cabecera y un contenedor de alto fijo con su propio scroll,
 * y al imprimir eso cortaría el documento en la primera hoja. Aquí se monta
 * una segunda copia del documento como hijo directo de `<body>` (portal),
 * invisible en pantalla; al imprimir se ocultan todos los demás hijos de
 * `<body>` —el panel entero, notificaciones incluidas— y solo queda ella, con
 * el flujo normal de páginas.
 *
 * Va con el tema claro aunque la cuenta use el oscuro: texto claro sobre un
 * papel blanco no se lee.
 */
const EstilosImpresion = createGlobalStyle`
  .vho-impresion { display: none; }

  @media print {
    @page { size: A4; margin: 12mm 12mm 14mm; }

    html, body {
      height: auto !important;
      overflow: visible !important;
      background: #fff !important;
    }
    body > *:not(.vho-impresion) { display: none !important; }
    .vho-impresion { display: block; }
    .vho-impresion * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .vho-impresion a { color: inherit; text-decoration: none; }

    /* Una sección o una fila no se parte entre dos hojas. */
    .vho-impresion .vho-sin-corte,
    .vho-impresion tr { break-inside: avoid; }
    /* La cabecera de una consulta no se queda sola al pie de la hoja. */
    .vho-impresion .vho-con-siguiente { break-after: avoid; }
    /* Cada mascota empieza en una hoja nueva. */
    .vho-impresion .vho-nueva-pagina { break-before: page; }
    /* Las tablas del Design System no necesitan scroll en papel. */
    .vho-impresion table { width: 100%; }
    .vho-impresion div:has(> table) { overflow: visible !important; box-shadow: none !important; }
  }
`;

export function Impresion({ children }) {
  const [nodo, setNodo] = React.useState(null);

  React.useEffect(() => {
    const div = document.createElement('div');
    div.className = 'vho-impresion';
    document.body.appendChild(div);
    setNodo(div);
    return () => div.remove();
  }, []);

  return (
    <>
      <EstilosImpresion />
      {nodo && createPortal(<ThemeProvider theme={lightTheme}>{children}</ThemeProvider>, nodo)}
    </>
  );
}
