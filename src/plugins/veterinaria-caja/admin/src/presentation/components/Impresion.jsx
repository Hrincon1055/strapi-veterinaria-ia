import * as React from 'react';
import { createPortal } from 'react-dom';
import { ThemeProvider, createGlobalStyle } from 'styled-components';
import { lightTheme } from '@strapi/design-system';

/**
 * Lo que sale en papel: el recibo (impresora térmica de 80 mm) o el informe de
 * cierre. Mismo mecanismo que la historia clínica (`veterinaria-historia`):
 * una copia montada como hija directa de `<body>` que solo se ve al imprimir,
 * con tema claro. Clases `vca-*` propias para no pisarse con los otros plugins.
 *
 * `ancho="80mm"` ajusta la hoja al rollo de la impresora térmica.
 */
const Estilos = createGlobalStyle`
  .vca-impresion { display: none; }
  @media print {
    @page { size: ${({ $ancho }) => ($ancho === '80mm' ? '80mm auto' : 'A4')}; margin: ${({ $ancho }) => ($ancho === '80mm' ? '3mm' : '12mm')}; }
    html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
    body > *:not(.vca-impresion) { display: none !important; }
    .vca-impresion { display: block; }
    .vca-impresion * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export function Impresion({ children, ancho = '80mm' }) {
  const [nodo, setNodo] = React.useState(null);
  React.useEffect(() => {
    const div = document.createElement('div');
    div.className = 'vca-impresion';
    document.body.appendChild(div);
    setNodo(div);
    return () => div.remove();
  }, []);
  return (
    <>
      <Estilos $ancho={ancho} />
      {nodo && createPortal(<ThemeProvider theme={lightTheme}>{children}</ThemeProvider>, nodo)}
    </>
  );
}
