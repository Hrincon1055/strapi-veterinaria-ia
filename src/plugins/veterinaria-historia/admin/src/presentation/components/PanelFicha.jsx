import * as React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@strapi/strapi/admin';
import { Flex, LinkButton, Typography } from '@strapi/design-system';
import { File } from '@strapi/icons';
import { RUTA, rutaHistoria } from './comunes';

const MASCOTA = 'api::pet.pet';
const CLIENTE = 'api::customer.customer';
const PERMISO = 'plugin::veterinaria-historia.historia.ver';

function Contenido({ model, documentId }) {
  const permisos = useAuth('PanelHistoria', (s) => s.permissions);
  if (!(permisos ?? []).some((p) => p.action === PERMISO)) {
    return <Typography variant="pi" textColor="neutral600">Sin acceso a la historia clínica.</Typography>;
  }
  const esMascota = model === MASCOTA;
  return (
    <Flex direction="column" gap={2} alignItems="stretch" width="100%">
      <LinkButton
        tag={RouterLink}
        to={esMascota ? rutaHistoria([documentId]) : `${RUTA}?cliente=${documentId}`}
        variant="secondary"
        size="S"
        startIcon={<File />}
        fullWidth
      >
        {esMascota ? 'Ver e imprimir historia' : 'Historia de sus mascotas'}
      </LinkButton>
    </Flex>
  );
}

/**
 * Panel lateral de la ficha de la mascota y del cliente en el Content
 * Manager (`addEditViewSidePanel`): un atajo a la historia imprimible. Solo en
 * documentos ya guardados, que son los que tienen historia.
 */
export const PanelFicha = ({ model, documentId }) => {
  if ((model !== MASCOTA && model !== CLIENTE) || !documentId) return null;
  return {
    title: 'Historia clínica',
    content: <Contenido model={model} documentId={documentId} />,
  };
};
