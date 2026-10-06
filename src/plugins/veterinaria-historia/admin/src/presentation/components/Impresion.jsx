import * as React from 'react';
import { createPortal } from 'react-dom';
import { ThemeProvider, createGlobalStyle } from 'styled-components';
import { lightTheme } from '@strapi/design-system';

/**
 * Lo que sale en papel.
 *
 * El documento no se imprime desde la página: el panel de Strapi pone la
 * navegación, la cabecera y un contenedor de alto fijo con su propio scroll,
 * y al imprimir eso cortaría la historia en la primera hoja. Aquí se monta
 * una segunda copia del documento como hijo directo de `<body>` (portal),
 * invisible en pantalla; al imprimir se ocultan todos los demás hijos de
 * `<body>` —el panel entero, notificaciones incluidas— y solo queda ella, con
 * el flujo normal de páginas.
 *
 * Va con el tema claro aunque la cuenta use el oscuro: texto claro sobre un
 * papel blanco no se lee.
 *
 * `tamano`: la historia va en A4; la fórmula médica, en A5.
 */
const EstilosImpresion = createGlobalStyle`
  .vh-impresion { display: none; }

  @media print {
    @page { size: ${(p) => p.$tamano}; margin: ${(p) => (p.$tamano === 'A5' ? '10mm' : '12mm 12mm 14mm')}; }

    html, body {
      height: auto !important;
      overflow: visible !important;
      background: #fff !important;
    }
    body > *:not(.vh-impresion) { display: none !important; }
    .vh-impresion { display: block; }
    .vh-impresion * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .vh-impresion a { color: inherit; text-decoration: none; }

    /* Una sección o una fila no se parte entre dos hojas. */
    .vh-impresion .vh-sin-corte,
    .vh-impresion tr { break-inside: avoid; }
    /* La cabecera de una consulta no se queda sola al pie de la hoja. */
    .vh-impresion .vh-con-siguiente { break-after: avoid; }
    /* Cada mascota empieza en una hoja nueva. */
    .vh-impresion .vh-nueva-pagina { break-before: page; }
    /* Las tablas del Design System no necesitan scroll en papel. */
    .vh-impresion table { width: 100%; }
    .vh-impresion div:has(> table) { overflow: visible !important; box-shadow: none !important; }
  }
`;

export function Impresion({ children, tamano = 'A4' }) {
  const [nodo, setNodo] = React.useState(null);

  React.useEffect(() => {
    const div = document.createElement('div');
    div.className = 'vh-impresion';
    document.body.appendChild(div);
    setNodo(div);
    return () => div.remove();
  }, []);

  return (
    <>
      <EstilosImpresion $tamano={tamano} />
      {nodo && createPortal(<ThemeProvider theme={lightTheme}>{children}</ThemeProvider>, nodo)}
    </>
  );
}
