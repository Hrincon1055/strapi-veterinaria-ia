import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Page, Layouts } from '@strapi/strapi/admin';
import {
  Box, Flex, Typography, Button, TextInput, Field, Checkbox, Loader, Alert, EmptyStateLayout, Badge,
} from '@strapi/design-system';
import { Search, File } from '@strapi/icons';
import { useHistoriaStore } from '../store';
import { useBusqueda, useCliente } from '../../application/useHistoria';
import { rutaHistoria } from '../components/comunes';

/** Un cliente con sus mascotas para marcar. */
function TarjetaCliente({ cliente, elegido, elegidas, onElegir, onAlternar }) {
  const n = cliente.mascotas.length;
  return (
    <Box
      padding={4}
      hasRadius
      background={elegido ? 'primary100' : 'neutral0'}
      borderColor={elegido ? 'primary600' : 'neutral200'}
    >
      <Flex direction="column" alignItems="stretch" gap={3}>
        <Flex justifyContent="space-between" alignItems="center" gap={4} wrap="wrap">
          <Flex direction="column" alignItems="flex-start" gap={1}>
            <Typography variant="omega" fontWeight="bold">{cliente.nombre}</Typography>
            <Typography variant="pi" textColor="neutral600">{cliente.documento ?? 'Sin documento'}</Typography>
          </Flex>
          {n > 1 && (
            <Button size="S" variant="tertiary" onClick={() => onElegir(cliente)}>Marcar todas</Button>
          )}
        </Flex>
        {n === 0 ? (
          <Typography variant="pi" textColor="neutral600">Sin mascotas registradas.</Typography>
        ) : (
          <Flex gap={4} wrap="wrap">
            {cliente.mascotas.map((m) => (
              <Checkbox
                key={m.documentId}
                checked={elegido && elegidas.includes(m.documentId)}
                onCheckedChange={() => onAlternar(cliente, m.documentId)}
              >
                <Typography variant="omega">
                  {m.nombre}
                  <Typography variant="pi" textColor="neutral600">
                    {[m.especie, m.raza].filter(Boolean).length ? ` · ${[m.especie, m.raza].filter(Boolean).join(', ')}` : ''}
                  </Typography>
                </Typography>
              </Checkbox>
            ))}
          </Flex>
        )}
      </Flex>
    </Box>
  );
}

/**
 * Elegir de quién es la historia: se busca al cliente (o a una de sus
 * mascotas) y se marcan las mascotas que entran. Solo de un propietario a la
 * vez: marcar una mascota de otro cliente cambia la selección.
 *
 * `?cliente=<documentId>` llega desde la ficha del cliente en el Content
 * Manager y deja a ese cliente elegido.
 */
export function InicioPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { q, setQ, cliente, elegidas, elegirCliente, alternarMascota } = useHistoriaStore();
  const busqueda = useBusqueda(q);
  const desdeFicha = useCliente(params.get('cliente'));

  React.useEffect(() => {
    if (desdeFicha.datos) elegirCliente(desdeFicha.datos);
  }, [desdeFicha.datos, elegirCliente]);

  const resultados = busqueda.datos ?? [];
  // El cliente elegido se queda a la vista aunque la búsqueda cambie.
  const lista = cliente && !resultados.some((r) => r.documentId === cliente.documentId) ? [cliente, ...resultados] : resultados;
  const buscando = q.trim().length >= 2;

  return (
    <Page.Main>
      <Page.Title>Historia clínica</Page.Title>
      <Layouts.Header
        title="Historia clínica"
        subtitle="Busca al propietario o a la mascota y elige qué mascotas entran en la historia"
        primaryAction={
          <Button
            startIcon={<File />}
            disabled={elegidas.length === 0}
            onClick={() => navigate(rutaHistoria(elegidas))}
          >
            {elegidas.length > 1 ? `Ver historia (${elegidas.length} mascotas)` : 'Ver historia'}
          </Button>
        }
      />
      <Layouts.Content>
        <Box background="neutral0" hasRadius shadow="tableShadow" padding={6}>
          <Flex direction="column" alignItems="stretch" gap={6}>
            <Field.Root name="buscar" hint="Nombre o documento del propietario, o nombre de la mascota">
              <Field.Label>Buscar</Field.Label>
              <TextInput
                startAction={<Search />}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ej.: Kira, Pérez, 1020…"
                autoFocus
              />
              <Field.Hint />
            </Field.Root>

            {cliente && (
              <Flex gap={2} alignItems="center">
                <Typography variant="pi" textColor="neutral600">Elegidas:</Typography>
                {elegidas.length === 0 ? (
                  <Typography variant="pi" textColor="neutral600">ninguna</Typography>
                ) : (
                  cliente.mascotas
                    .filter((m) => elegidas.includes(m.documentId))
                    .map((m) => <Badge key={m.documentId}>{m.nombre}</Badge>)
                )}
                <Typography variant="pi" textColor="neutral600">· {cliente.nombre}</Typography>
              </Flex>
            )}

            {(busqueda.cargando || desdeFicha.cargando) && (
              <Flex justifyContent="center" padding={6}><Loader>Buscando…</Loader></Flex>
            )}
            {busqueda.error && <Alert variant="danger" title="No se pudo buscar">{busqueda.error}</Alert>}
            {desdeFicha.error && <Alert variant="danger" title="No se pudo abrir el cliente">{desdeFicha.error}</Alert>}

            {!busqueda.cargando && lista.length === 0 && (
              <EmptyStateLayout
                hasRadius
                content={buscando ? 'Ningún cliente ni mascota coincide con la búsqueda.' : 'Escribe al menos dos letras para buscar.'}
              />
            )}

            <Flex direction="column" alignItems="stretch" gap={3}>
              {lista.map((c) => (
                <TarjetaCliente
                  key={c.documentId}
                  cliente={c}
                  elegido={cliente?.documentId === c.documentId}
                  elegidas={elegidas}
                  onElegir={elegirCliente}
                  onAlternar={alternarMascota}
                />
              ))}
            </Flex>
          </Flex>
        </Box>
      </Layouts.Content>
    </Page.Main>
  );
}
