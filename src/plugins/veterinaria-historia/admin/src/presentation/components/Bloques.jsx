import * as React from 'react';
import { Box, Flex, Typography } from '@strapi/design-system';
import { urlArchivo } from '../../domain/formato';

/**
 * Pinta un campo `blocks` de Strapi (anamnesis, hallazgos, indicaciones…)
 * con la tipografía del Design System. Cubre lo que produce el editor de
 * bloques del panel: párrafos, títulos, listas (anidadas), citas, código,
 * imágenes, enlaces y los modificadores de texto.
 */

function Texto({ n }) {
  let el = n.text;
  if (n.code) el = <code>{el}</code>;
  if (n.bold) el = <strong>{el}</strong>;
  if (n.italic) el = <em>{el}</em>;
  if (n.underline) el = <u>{el}</u>;
  if (n.strikethrough) el = <s>{el}</s>;
  return el;
}

function Hijos({ nodos }) {
  return (nodos ?? []).map((n, i) => {
    if (n.type === 'link') {
      return <a key={i} href={n.url} target="_blank" rel="noreferrer"><Hijos nodos={n.children} /></a>;
    }
    if (n.type === 'text' || typeof n.text === 'string') return <Texto key={i} n={n} />;
    return null;
  });
}

/** Un párrafo que solo tiene texto vacío: el editor lo deja al pulsar Intro. */
const vacio = (b) =>
  b.type === 'paragraph' && (b.children ?? []).every((c) => typeof c.text === 'string' && !c.text.trim());

function Lista({ b }) {
  const ordenada = b.format === 'ordered';
  return (
    <Box tag={ordenada ? 'ol' : 'ul'} paddingLeft={5} margin={0} style={{ listStyle: ordenada ? 'decimal' : 'disc' }}>
      {(b.children ?? []).map((item, i) =>
        item.type === 'list' ? (
          <li key={i} style={{ listStyle: 'none' }}><Lista b={item} /></li>
        ) : (
          <Typography key={i} tag="li" variant="omega" style={{ display: 'list-item' }}>
            <Hijos nodos={item.children} />
          </Typography>
        )
      )}
    </Box>
  );
}

function Bloque({ b }) {
  switch (b.type) {
    case 'heading':
      return (
        <Typography tag={`h${Math.min(6, Math.max(1, b.level ?? 3))}`} variant="delta">
          <Hijos nodos={b.children} />
        </Typography>
      );
    case 'list':
      return <Lista b={b} />;
    case 'quote':
      return (
        <Box paddingLeft={3} borderStyle="solid" borderColor="neutral300" style={{ borderWidth: '0 0 0 3px' }}>
          <Typography variant="omega" textColor="neutral700" style={{ fontStyle: 'italic' }}><Hijos nodos={b.children} /></Typography>
        </Box>
      );
    case 'code':
      return (
        <Box background="neutral100" padding={2} hasRadius>
          <Typography tag="pre" variant="pi" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0 }}>
            <Hijos nodos={b.children} />
          </Typography>
        </Box>
      );
    case 'image':
      return b.image?.url ? (
        <img src={urlArchivo(b.image.url)} alt={b.image.alternativeText ?? ''} style={{ maxWidth: '100%', maxHeight: 280 }} />
      ) : null;
    case 'paragraph':
    default:
      return (
        <Typography tag="p" variant="omega" style={{ whiteSpace: 'pre-wrap' }}>
          <Hijos nodos={b.children} />
        </Typography>
      );
  }
}

export function Bloques({ valor }) {
  const bloques = Array.isArray(valor) ? valor.filter((b) => !vacio(b)) : [];
  if (bloques.length === 0) return null;
  return (
    <Flex direction="column" alignItems="stretch" gap={2}>
      {bloques.map((b, i) => <Bloque key={i} b={b} />)}
    </Flex>
  );
}

/** ¿Tiene algo que pintar? Para no dejar títulos huérfanos. */
export const tieneContenido = (valor) => Array.isArray(valor) && valor.some((b) => !vacio(b));
