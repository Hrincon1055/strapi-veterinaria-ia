import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Page, Layouts, BackButton } from '@strapi/strapi/admin';
import { Alert, Badge, Box, Button, Flex, Loader } from '@strapi/design-system';
import { File } from '@strapi/icons';
import { useFichaFormula } from '../../application/useFormula';
import { useImprimir } from '../../application/useHistoria';
import { ESTADO_FORMULA } from '../../domain/formato';
import { FormulaDocumento } from '../components/FormulaDocumento';
import { Impresion } from '../components/Impresion';

const CONSULTA = '/content-manager/collection-types/api::clinical.consultation';

/**
 * Vista previa e impresión de una fórmula médica (`formula/:id`). Se llega
 * desde el panel lateral de la consulta, al emitir o con "Reimprimir".
 */
export function FormulaPage() {
  const { id } = useParams();
  const { datos, cargando, error } = useFichaFormula(id);
  const imprimir = useImprimir();

  const titulo = datos ? `Fórmula ${datos.numero} — ${datos.mascota?.nombre ?? ''}`.trim() : 'Fórmula médica';
  const estado = datos ? ESTADO_FORMULA[datos.estado] : null;

  return (
    <Page.Main>
      <Page.Title>{titulo}</Page.Title>
      <Layouts.Header
        navigationAction={
          <BackButton fallback={datos?.consulta ? `${CONSULTA}/${datos.consulta.documentId}` : '/content-manager'} />
        }
        title={titulo}
        subtitle={datos?.propietario ? `Propietario: ${datos.propietario.nombre}` : undefined}
        secondaryAction={
          estado && <Badge backgroundColor={`${estado.color}100`} textColor={`${estado.color}700`}>{estado.rotulo}</Badge>
        }
        primaryAction={
          <Button startIcon={<File />} disabled={!datos} onClick={() => imprimir(`Fórmula ${datos.numero}`)}>
            Imprimir
          </Button>
        }
      />
      <Layouts.Content>
        {cargando ? (
          <Flex justifyContent="center" padding={8}><Loader>Cargando la fórmula…</Loader></Flex>
        ) : error ? (
          <Alert variant="danger" title="No se pudo cargar la fórmula">{error}</Alert>
        ) : (
          <Flex justifyContent="center">
            {/* El ancho de una hoja A5 menos márgenes: la vista previa ya es el papel. */}
            <Box background="neutral0" hasRadius shadow="tableShadow" padding={6} style={{ width: '148mm', maxWidth: '100%' }}>
              <FormulaDocumento f={datos} />
            </Box>
          </Flex>
        )}
      </Layouts.Content>

      {datos && (
        <Impresion tamano="A5">
          <FormulaDocumento f={datos} />
        </Impresion>
      )}
    </Page.Main>
  );
}
