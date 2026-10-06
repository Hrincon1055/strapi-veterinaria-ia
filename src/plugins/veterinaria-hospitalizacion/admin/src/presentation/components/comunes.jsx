import * as React from 'react';
import { Badge, Box, Flex, Typography, Loader, Alert, EmptyStateLayout } from '@strapi/design-system';

export const RUTA = '/plugins/veterinaria-hospitalizacion';
export const rutaHoja = (id, dia) => `${RUTA}/${id}${dia ? `?dia=${dia}` : ''}`;

/** Insignia con los colores del Design System (`success100`/`success700`…). */
export function Insignia({ estado, mapa, children }) {
  const e = mapa?.[estado] ?? { rotulo: children ?? estado, color: 'neutral' };
  return (
    <Badge backgroundColor={`${e.color}100`} textColor={`${e.color}700`}>
      {children ?? e.rotulo}
    </Badge>
  );
}

/** Pareja etiqueta / valor. */
export function Dato({ etiqueta, children }) {
  return (
    <Flex justifyContent="space-between" gap={4} alignItems="flex-start">
      <Typography variant="pi" textColor="neutral600">{etiqueta}</Typography>
      <Typography variant="pi" fontWeight="bold" textAlign="right">{children ?? '—'}</Typography>
    </Flex>
  );
}

/** Tarjeta blanca con título, el bloque base de las páginas del módulo. */
export function Tarjeta({ titulo, subtitulo, acciones, children, padding = 6 }) {
  return (
    <Box background="neutral0" hasRadius shadow="tableShadow" padding={padding}>
      {(titulo || acciones) && (
        <Flex justifyContent="space-between" alignItems="center" paddingBottom={4} gap={2} wrap="wrap">
          <Flex direction="column" alignItems="flex-start" gap={1}>
            {titulo && <Typography variant="delta" tag="h2">{titulo}</Typography>}
            {subtitulo && <Typography variant="pi" textColor="neutral600">{subtitulo}</Typography>}
          </Flex>
          {acciones && <Flex gap={2} wrap="wrap">{acciones}</Flex>}
        </Flex>
      )}
      {children}
    </Box>
  );
}

/** Carga, error o vacío; si no, el contenido. */
export function Estado({ cargando, error, vacio, children }) {
  if (cargando) return <Flex justifyContent="center" padding={8}><Loader>Cargando…</Loader></Flex>;
  if (error) return <Alert variant="danger" title="No se pudo cargar">{error}</Alert>;
  if (vacio) return <EmptyStateLayout content={vacio} hasRadius />;
  return children;
}
