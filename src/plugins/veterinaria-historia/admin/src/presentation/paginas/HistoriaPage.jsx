import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Layouts, BackButton } from '@strapi/strapi/admin';
import {
  Box, Flex, Button, TextInput, Field, Checkbox, Loader, Alert, EmptyStateLayout, SingleSelect, SingleSelectOption,
  Typography,
} from '@strapi/design-system';
import { File } from '@strapi/icons';
import { useHistoriaClinica, useImprimir } from '../../application/useHistoria';
import { Documento } from '../components/Documento';
import { Impresion } from '../components/Impresion';
import { RUTA } from '../components/comunes';

/**
 * Vista previa e impresión de la historia.
 *
 * `?mascotas=id1,id2&desde=&hasta=&orden=` — los filtros viven en la URL: una
 * recarga o un enlace compartido muestran exactamente lo mismo. Lo que se
 * incluye (servicios, adjuntos) es solo de presentación y no pide datos.
 */
export function HistoriaPage() {
  const [params, setParams] = useSearchParams();
  const mascotas = (params.get('mascotas') ?? '').split(',').filter(Boolean);
  const desde = params.get('desde') ?? '';
  const hasta = params.get('hasta') ?? '';
  const orden = params.get('orden') === 'asc' ? 'asc' : 'desc';
  const [opciones, setOpciones] = React.useState({ lineas: true, adjuntos: true });

  const { datos, cargando, error } = useHistoriaClinica({ mascotas, desde, hasta, orden });
  const imprimir = useImprimir();

  const cambiar = (clave, valor) => {
    const p = new URLSearchParams(params);
    if (valor) p.set(clave, valor);
    else p.delete(clave);
    setParams(p, { replace: true });
  };

  const nombres = datos?.mascotas.map((m) => m.nombre) ?? [];
  const titulo = nombres.length ? `Historia clínica — ${nombres.join(', ')}` : 'Historia clínica';

  return (
    <Page.Main>
      <Page.Title>{titulo}</Page.Title>
      <Layouts.Header
        navigationAction={<BackButton fallback={RUTA} />}
        title={titulo}
        subtitle={datos?.propietario ? `Propietario: ${datos.propietario.nombre}` : undefined}
        primaryAction={
          <Button startIcon={<File />} disabled={!datos} onClick={() => imprimir(titulo)}>
            Imprimir
          </Button>
        }
      />
      <Layouts.Content>
        <Flex direction="column" alignItems="stretch" gap={4}>
          <Box background="neutral0" hasRadius shadow="tableShadow" padding={4}>
            <Flex gap={4} alignItems="flex-end" wrap="wrap">
              <Field.Root name="desde">
                <Field.Label>Consultas desde</Field.Label>
                <TextInput type="date" value={desde} onChange={(e) => cambiar('desde', e.target.value)} />
              </Field.Root>
              <Field.Root name="hasta">
                <Field.Label>Hasta</Field.Label>
                <TextInput type="date" value={hasta} onChange={(e) => cambiar('hasta', e.target.value)} />
              </Field.Root>
              <Field.Root name="orden">
                <Field.Label>Orden</Field.Label>
                <SingleSelect value={orden} onChange={(v) => cambiar('orden', v === 'asc' ? 'asc' : '')}>
                  <SingleSelectOption value="desc">Más reciente primero</SingleSelectOption>
                  <SingleSelectOption value="asc">Cronológico</SingleSelectOption>
                </SingleSelect>
              </Field.Root>
              <Flex gap={4} paddingBottom={2}>
                <Checkbox checked={opciones.lineas} onCheckedChange={(v) => setOpciones((o) => ({ ...o, lineas: Boolean(v) }))}>
                  Servicios y productos
                </Checkbox>
                <Checkbox checked={opciones.adjuntos} onCheckedChange={(v) => setOpciones((o) => ({ ...o, adjuntos: Boolean(v) }))}>
                  Adjuntos
                </Checkbox>
              </Flex>
            </Flex>
            <Box paddingTop={3}>
              <Typography variant="pi" textColor="neutral600">
                El periodo filtra consultas y vacunas. Las alergias salen siempre completas. Cada mascota empieza en una hoja nueva.
              </Typography>
            </Box>
          </Box>

          {mascotas.length === 0 ? (
            <EmptyStateLayout hasRadius content="No hay mascotas elegidas. Vuelve atrás y marca al menos una." />
          ) : cargando && !datos ? (
            <Flex justifyContent="center" padding={8}><Loader>Reuniendo la historia…</Loader></Flex>
          ) : error ? (
            <Alert variant="danger" title="No se pudo cargar la historia">{error}</Alert>
          ) : datos ? (
            <Box
              background="neutral0"
              hasRadius
              shadow="tableShadow"
              padding={8}
              style={{ opacity: cargando ? 0.5 : 1, transition: 'opacity 150ms' }}
            >
              <Documento historia={datos} opciones={opciones} />
            </Box>
          ) : null}
        </Flex>
      </Layouts.Content>

      {datos && (
        <Impresion>
          <Documento historia={datos} opciones={opciones} />
        </Impresion>
      )}
    </Page.Main>
  );
}
