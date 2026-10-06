import * as React from 'react';
import { Page, Layouts } from '@strapi/strapi/admin';
import { Box, Flex, Typography, LinkButton } from '@strapi/design-system';
import { Monitor } from '@strapi/icons';
import { RUTA_POS } from '../rutas';

/**
 * Página de entrada del módulo. Normalmente no se ve: el enlace del menú abre
 * el punto de venta directamente en otra pestaña (ver `index.jsx`). Sirve si
 * se llega aquí escribiendo la dirección o si el navegador bloquea la pestaña.
 */
export function EntradaPage() {
  return (
    <Page.Main>
      <Layouts.Header title="Punto de venta" subtitle="Caja de la clínica: abrir turno, vender, cobrar y cuadrar" />
      <Layouts.Content>
        <Box background="neutral0" hasRadius shadow="tableShadow" padding={8}>
          <Flex direction="column" gap={4} alignItems="flex-start">
            <Typography>
              El punto de venta se abre en una pestaña aparte, a pantalla completa, con la misma sesión del panel.
            </Typography>
            <LinkButton href={RUTA_POS} target="_blank" rel="noopener" size="L" startIcon={<Monitor />}>
              Abrir punto de venta
            </LinkButton>
          </Flex>
        </Box>
      </Layouts.Content>
    </Page.Main>
  );
}
