import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Layouts } from '@strapi/strapi/admin';
import {
  Box, Flex, Typography, Tabs, Table, Thead, Tbody, Tr, Th, Td, Button, TextInput, Field,
  SingleSelect, SingleSelectOption, Loader, Alert, EmptyStateLayout, Badge,
} from '@strapi/design-system';
import { Plus } from '@strapi/icons';
import { useFacturacionStore } from '../store';
import { usePendientes, useFacturas, usePermisos, useVentaDirecta } from '../../application/useFacturacion';
import { dinero, fecha, fechaHora, ESTADO_FACTURA, ESTADO_PAGO } from '../../domain/formato';
import { Insignia, RUTA } from '../components/comunes';
import { ModalVentaDirecta } from '../components/modales';

const Cabecera = ({ columnas }) => (
  <Thead>
    <Tr>
      {columnas.map((c) => <Th key={c}><Typography variant="sigma">{c}</Typography></Th>)}
    </Tr>
  </Thead>
);

function Estado({ cargando, error, vacio, children }) {
  if (cargando) return <Flex justifyContent="center" padding={8}><Loader>Cargando…</Loader></Flex>;
  if (error) return <Alert variant="danger" title="No se pudo cargar">{error}</Alert>;
  if (vacio) return <EmptyStateLayout content={vacio} hasRadius />;
  return children;
}

function FiltroFecha({ etiqueta, valor, onCambio }) {
  return (
    <Field.Root name={etiqueta}>
      <Field.Label>{etiqueta}</Field.Label>
      <TextInput type="date" value={valor ?? ''} onChange={(e) => onCambio(e.target.value)} />
    </Field.Root>
  );
}

/** Consultas con algún concepto pendiente de cobro o atendidas sin cargo de consulta. */
function Pendientes() {
  const navigate = useNavigate();
  const { filtrosPendientes: f, setFiltrosPendientes } = useFacturacionStore();
  const { datos, cargando, error } = usePendientes();

  return (
    <Flex direction="column" gap={4} alignItems="stretch">
      <Flex gap={4} alignItems="flex-end" wrap="wrap">
        <FiltroFecha etiqueta="Consultas desde" valor={f.desde} onCambio={(desde) => setFiltrosPendientes({ desde })} />
        <FiltroFecha etiqueta="Hasta" valor={f.hasta} onCambio={(hasta) => setFiltrosPendientes({ hasta })} />
      </Flex>
      <Estado cargando={cargando} error={error} vacio={datos?.length === 0 && 'No hay consultas con conceptos pendientes de cobro en ese periodo.'}>
        <Table colCount={6} rowCount={(datos?.length ?? 0) + 1}>
          <Cabecera columnas={['Consulta', 'Mascota', 'Cliente', 'Pendientes', 'Valor estimado', '']} />
          <Tbody>
            {(datos ?? []).map((c) => (
              <Tr key={c.consulta.documentId} onClick={() => navigate(`${RUTA}/consultas/${c.consulta.documentId}`)} style={{ cursor: 'pointer' }}>
                <Td><Typography>{fechaHora(c.consulta.consultedAt)}</Typography></Td>
                <Td><Typography>{c.mascota?.name ?? '—'}</Typography></Td>
                <Td><Typography>{c.cliente?.nombre ?? '—'}</Typography></Td>
                <Td>
                  <Flex gap={2}>
                    <Typography>{c.pendientes}</Typography>
                    {c.sinCargoDeConsulta && (
                      <Badge backgroundColor="warning100" textColor="warning700">Sin cargo de consulta</Badge>
                    )}
                  </Flex>
                </Td>
                <Td><Typography>{dinero(c.valorPendiente)}</Typography></Td>
                <Td><Button size="S" variant="secondary">Facturar</Button></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Estado>
      <Typography variant="pi" textColor="neutral600">
        El valor es una estimación con el catálogo de hoy; el precio se fija al crear el borrador.
        Una línea sin precio o sin perfil de IVA en el catálogo no suma aquí y no se puede facturar hasta corregirla.
        "Sin cargo de consulta": atendida sin ningún servicio registrado; si se cobra, añade el servicio al
        facturarla. Una cortesía se factura con descuento del 100 % en el renglón.
      </Typography>
    </Flex>
  );
}

/** Todas las facturas, con filtros. */
function Facturas() {
  const navigate = useNavigate();
  const { filtrosFacturas: f, setFiltrosFacturas } = useFacturacionStore();
  const { datos, cargando, error } = useFacturas();
  const filas = datos?.data ?? [];
  const pag = datos?.paginacion;

  return (
    <Flex direction="column" gap={4} alignItems="stretch">
      <Flex gap={4} alignItems="flex-end" wrap="wrap">
        <Field.Root name="q">
          <Field.Label>Buscar</Field.Label>
          <TextInput value={f.q} onChange={(e) => setFiltrosFacturas({ q: e.target.value })} placeholder="Número o cliente" />
        </Field.Root>
        <Field.Root name="estado">
          <Field.Label>Estado</Field.Label>
          <SingleSelect value={f.estado} onChange={(estado) => setFiltrosFacturas({ estado })} placeholder="Todos">
            <SingleSelectOption value="">Todos</SingleSelectOption>
            {Object.entries(ESTADO_FACTURA).map(([k, v]) => <SingleSelectOption key={k} value={k}>{v.rotulo}</SingleSelectOption>)}
          </SingleSelect>
        </Field.Root>
        <Field.Root name="pago">
          <Field.Label>Pago</Field.Label>
          <SingleSelect value={f.pago} onChange={(pago) => setFiltrosFacturas({ pago })} placeholder="Todos">
            <SingleSelectOption value="">Todos</SingleSelectOption>
            {Object.entries(ESTADO_PAGO).map(([k, v]) => <SingleSelectOption key={k} value={k}>{v.rotulo}</SingleSelectOption>)}
          </SingleSelect>
        </Field.Root>
        <FiltroFecha etiqueta="Desde" valor={f.desde} onCambio={(desde) => setFiltrosFacturas({ desde })} />
        <FiltroFecha etiqueta="Hasta" valor={f.hasta} onCambio={(hasta) => setFiltrosFacturas({ hasta })} />
      </Flex>

      <Estado cargando={cargando} error={error} vacio={filas.length === 0 && 'No hay facturas con esos filtros.'}>
        <Table colCount={6} rowCount={filas.length + 1}>
          <Cabecera columnas={['Número', 'Cliente', 'Fecha', 'Estado', 'Pago', 'Total']} />
          <Tbody>
            {filas.map((x) => (
              <Tr key={x.documentId} onClick={() => navigate(`${RUTA}/facturas/${x.documentId}`)} style={{ cursor: 'pointer' }}>
                <Td><Typography fontWeight="bold">{x.numero ?? 'Borrador'}</Typography></Td>
                <Td><Typography>{x.cliente?.nombre ?? '—'}</Typography></Td>
                <Td><Typography>{fecha(x.emitidaEl ?? x.creadaEl)}</Typography></Td>
                <Td><Insignia estado={x.estado} mapa={ESTADO_FACTURA} /></Td>
                <Td>{x.estado === 'draft' ? <Typography textColor="neutral500">—</Typography> : <Insignia estado={x.pago} mapa={ESTADO_PAGO} />}</Td>
                <Td><Typography>{dinero(x.total, x.moneda)}</Typography></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        {pag && pag.paginas > 1 && (
          <Flex justifyContent="space-between" alignItems="center">
            <Typography variant="pi" textColor="neutral600">{pag.total} facturas · página {pag.pagina} de {pag.paginas}</Typography>
            <Flex gap={2}>
              <Button variant="tertiary" disabled={pag.pagina <= 1} onClick={() => setFiltrosFacturas({ page: pag.pagina - 1 })}>Anterior</Button>
              <Button variant="tertiary" disabled={pag.pagina >= pag.paginas} onClick={() => setFiltrosFacturas({ page: pag.pagina + 1 })}>Siguiente</Button>
            </Flex>
          </Flex>
        )}
      </Estado>
    </Flex>
  );
}

export function InicioPage() {
  const navigate = useNavigate();
  const permisos = usePermisos();
  const { pestana, setPestana } = useFacturacionStore();
  const venta = useVentaDirecta();
  const [ventaAbierta, setVentaAbierta] = React.useState(false);

  return (
    <Page.Main>
      <Layouts.Header
        title="Facturación"
        subtitle="Cobra los servicios y productos de las consultas y gestiona las facturas"
        primaryAction={permisos?.puedePreparar && (
          <Button startIcon={<Plus />} variant="secondary" onClick={() => setVentaAbierta(true)}>Venta directa</Button>
        )}
      />
      <Layouts.Content>
        <Box background="neutral0" hasRadius shadow="tableShadow" padding={6}>
          <Tabs.Root value={pestana} onValueChange={setPestana}>
            <Tabs.List aria-label="Secciones de facturación">
              <Tabs.Trigger value="pendientes">Pendientes de cobro</Tabs.Trigger>
              <Tabs.Trigger value="facturas">Facturas</Tabs.Trigger>
            </Tabs.List>
            <Box paddingTop={6}>
              <Tabs.Content value="pendientes"><Pendientes /></Tabs.Content>
              <Tabs.Content value="facturas"><Facturas /></Tabs.Content>
            </Box>
          </Tabs.Root>
        </Box>
      </Layouts.Content>

      <ModalVentaDirecta
        abierto={ventaAbierta}
        onCerrar={() => setVentaAbierta(false)}
        buscarClientes={venta.buscarClientes}
        onCrear={async (cliente) => {
          const id = await venta.crear(cliente);
          if (id) navigate(`${RUTA}/facturas/${id}`);
        }}
      />
    </Page.Main>
  );
}
