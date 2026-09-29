import * as React from 'react';
import { Badge, Box, Flex, Typography, Divider } from '@strapi/design-system';
import { dinero } from '../../domain/formato';

export const RUTA = '/plugins/veterinaria-facturacion';

/** Insignia con los colores del Design System (`success100`/`success700`…). */
export function Insignia({ estado, mapa }) {
  const e = mapa[estado] ?? { rotulo: estado, color: 'neutral' };
  return (
    <Badge backgroundColor={`${e.color}100`} textColor={`${e.color}700`}>
      {e.rotulo}
    </Badge>
  );
}

/** Pareja etiqueta / valor, como en el modal de cita de la agenda. */
export function Dato({ etiqueta, children }) {
  return (
    <Flex justifyContent="space-between" gap={4}>
      <Typography variant="pi" textColor="neutral600">{etiqueta}</Typography>
      <Typography variant="pi" fontWeight="bold" textAlign="right">{children ?? '—'}</Typography>
    </Flex>
  );
}

/** Tarjeta blanca con título, el bloque base de las páginas del módulo. */
export function Tarjeta({ titulo, acciones, children }) {
  return (
    <Box background="neutral0" hasRadius shadow="tableShadow" padding={6}>
      {(titulo || acciones) && (
        <Flex justifyContent="space-between" alignItems="center" paddingBottom={4} gap={2} wrap="wrap">
          {titulo && <Typography variant="delta" tag="h2">{titulo}</Typography>}
          {acciones}
        </Flex>
      )}
      {children}
    </Box>
  );
}

/** Subtotal, descuentos, IVA y total de una factura. */
export function Totales({ factura }) {
  const m = factura.moneda;
  return (
    <Flex direction="column" gap={2} alignItems="stretch" style={{ minWidth: 260 }}>
      <Dato etiqueta="Subtotal">{dinero(factura.subtotal, m)}</Dato>
      {factura.descuentos > 0 && <Dato etiqueta="Descuentos">- {dinero(factura.descuentos, m)}</Dato>}
      <Dato etiqueta="IVA">{dinero(factura.impuesto, m)}</Dato>
      <Divider />
      <Flex justifyContent="space-between">
        <Typography variant="omega" fontWeight="bold">Total</Typography>
        <Typography variant="beta">{dinero(factura.total, m)}</Typography>
      </Flex>
    </Flex>
  );
}
