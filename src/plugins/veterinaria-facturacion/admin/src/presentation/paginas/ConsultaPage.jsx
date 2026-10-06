import * as React from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { Page, Layouts, BackButton } from '@strapi/strapi/admin';
import {
  Flex, Typography, Table, Thead, Tbody, Tr, Th, Td, Button, Checkbox, Loader, Alert, Link, Box,
} from '@strapi/design-system';
import { usePermisos, useConsulta } from '../../application/useFacturacion';
import { dinero, fechaHora, cantidad, ESTADO_LINEA, RESUMEN_CONSULTA, ESTADO_CLINICO } from '../../domain/formato';
import { Insignia, Tarjeta, Dato, RUTA } from '../components/comunes';

/**
 * Consulta (u hospitalización) → conceptos → borrador.
 *
 * Con `origen="hospitalizacion"` los conceptos son los días de estancia y las
 * tomas administradas; el estado llega con la misma forma que el de una
 * consulta (`api::billing.invoicing.estadoDeHospitalizacion`).
 *
 * Cada línea dice en qué punto de cobro está: pendiente (se puede marcar),
 * facturada (con enlace a su factura) o no facturable (y por qué). Lo que no
 * se puede cobrar no ofrece casilla: la regla del servidor lo rechazaría igual.
 */
export function ConsultaPage({ origen = 'consulta' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const permisos = usePermisos();
  const { datos: e, cargando, error, creando, crearBorrador } = useConsulta(id, origen);
  const esHospitalizacion = origen === 'hospitalizacion';
  const fechaOrigen = e ? (esHospitalizacion ? e.hospitalizacion.admittedAt : e.consulta.consultedAt) : null;
  const [elegidas, setElegidas] = React.useState([]);

  // Al cargar, se proponen todas las pendientes que se pueden cobrar.
  React.useEffect(() => {
    if (!e) return;
    setElegidas(e.lineas.filter((l) => l.estado === 'pendiente' && !l.estimado?.problema).map((l) => l.lineKey));
  }, [e]);

  const alternar = (k) => setElegidas((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]));
  const totalElegido = (e?.lineas ?? [])
    .filter((l) => elegidas.includes(l.lineKey))
    .reduce((s, l) => s + (l.estimado?.lineTotal ?? 0), 0);

  return (
    <Page.Main>
      <Layouts.Header
        navigationAction={<BackButton fallback={RUTA} />}
        title={e ? `${esHospitalizacion ? 'Hospitalización' : 'Consulta'} de ${e.mascota?.name ?? 'mascota'}` : esHospitalizacion ? 'Hospitalización' : 'Consulta'}
        subtitle={e ? `${esHospitalizacion ? 'Ingreso ' : ''}${fechaHora(fechaOrigen)} · ${e.cliente?.nombre ?? ''}` : undefined}
        primaryAction={permisos?.puedePreparar && e && (
          <Button
            disabled={elegidas.length === 0}
            loading={creando}
            onClick={async () => {
              const idFactura = await crearBorrador(elegidas.map((k) => ({ [esHospitalizacion ? 'hospitalizacion' : 'consulta']: id, lineKey: k })));
              if (idFactura) navigate(`${RUTA}/facturas/${idFactura}`);
            }}
          >
            Crear borrador con {elegidas.length} concepto(s)
          </Button>
        )}
      />
      <Layouts.Content>
        {cargando && <Flex justifyContent="center" padding={8}><Loader>Cargando la consulta…</Loader></Flex>}
        {error && <Alert variant="danger" title={`No se pudo cargar la ${esHospitalizacion ? 'hospitalización' : 'consulta'}`}>{error}</Alert>}
        {e && (
          <Flex direction="column" gap={4} alignItems="stretch">
            <Tarjeta
              titulo="Estado de facturación"
              acciones={
                esHospitalizacion ? (
                  <Link tag={RouterLink} to={`/plugins/veterinaria-hospitalizacion/${id}`}>Abrir la hoja</Link>
                ) : (
                  <Link tag={RouterLink} to={`/content-manager/collection-types/api::clinical.consultation/${id}`}>
                    Abrir la consulta
                  </Link>
                )
              }
            >
              <Flex gap={8} wrap="wrap" alignItems="flex-start">
                <Box style={{ minWidth: 240 }}>
                  <Flex direction="column" gap={2} alignItems="stretch">
                    <Dato etiqueta="Resumen"><Insignia estado={e.resumen} mapa={RESUMEN_CONSULTA} /></Dato>
                    <Dato etiqueta="Pendientes">{e.pendientes}</Dato>
                    <Dato etiqueta="Valor pendiente (estimado)">{dinero(e.valorPendiente)}</Dato>
                  </Flex>
                </Box>
                {e.sinServicioDeEstancia && (
                  <Alert variant="warning" title="Días sin servicio">
                    Ni la jaula ni Clínica tienen servicio de hospitalización por día: esos días no se pueden cobrar
                    hasta que la administración lo configure.
                  </Alert>
                )}
                {e.consulta?.archivada && (
                  <Alert variant="warning" title="Consulta archivada">No se factura una consulta archivada.</Alert>
                )}
                {e.sinCargoDeConsulta && (
                  <Alert variant="warning" title="Sin cargo de consulta">
                    La consulta se atendió pero no tiene ningún servicio registrado. Si se cobra, añádelo en el borrador
                    con "Añadir conceptos" (o en la consulta, en Servicios y productos).
                  </Alert>
                )}
              </Flex>
            </Tarjeta>

            <Tarjeta titulo={esHospitalizacion ? 'Días de estancia y medicación administrada' : 'Servicios y productos de la consulta'}>
              {e.lineas.length === 0 ? (
                <Typography textColor="neutral600">
                  {esHospitalizacion
                    ? 'La hospitalización todavía no tiene conceptos que cobrar.'
                    : 'La consulta no tiene servicios ni productos. Añádelos en la consulta (Servicios y productos) para poder cobrarlos.'}
                </Typography>
              ) : (
                <Table colCount={7} rowCount={e.lineas.length + 1}>
                  <Thead>
                    <Tr>
                      {['', 'Concepto', 'Cantidad', esHospitalizacion ? 'Tipo' : 'En la consulta', 'Cobro', 'Valor estimado', 'Factura'].map((c) => (
                        <Th key={c}><Typography variant="sigma">{c}</Typography></Th>
                      ))}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {e.lineas.map((l) => {
                      const elegible = l.estado === 'pendiente' && !l.estimado?.problema && permisos?.puedePreparar;
                      return (
                        <Tr key={l.lineKey}>
                          <Td>
                            {elegible ? (
                              <Checkbox aria-label={`Facturar ${l.label}`} checked={elegidas.includes(l.lineKey)} onCheckedChange={() => alternar(l.lineKey)} />
                            ) : null}
                          </Td>
                          <Td>
                            <Typography fontWeight="bold">{l.label ?? '—'}</Typography>
                            <Typography variant="pi" textColor="neutral600">{l.tipo === 'servicio' ? ' · Servicio' : ' · Producto'}</Typography>
                          </Td>
                          <Td><Typography>{cantidad(l.quantity)}</Typography></Td>
                          <Td><Typography>{ESTADO_CLINICO[l.state] ?? l.state}</Typography></Td>
                          <Td>
                            <Insignia estado={l.estado} mapa={ESTADO_LINEA} />
                            {l.motivo && <Typography variant="pi" textColor="neutral600"> {l.motivo}</Typography>}
                          </Td>
                          <Td>
                            {l.estimado?.problema
                              ? <Typography variant="pi" textColor="danger600">{l.estimado.problema}</Typography>
                              : <Typography>{l.estimado?.lineTotal != null ? dinero(l.estimado.lineTotal) : '—'}</Typography>}
                          </Td>
                          <Td>
                            {l.factura ? (
                              <Link tag={RouterLink} to={`${RUTA}/facturas/${l.factura.documentId}`}>{l.factura.fullNumber ?? 'Borrador'}</Link>
                            ) : l.anteriores.length > 0 ? (
                              <Typography variant="pi" textColor="neutral600">Anulada: {l.anteriores.map((a) => a.fullNumber ?? 'borrador').join(', ')}</Typography>
                            ) : <Typography textColor="neutral500">—</Typography>}
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              )}
              {permisos?.puedePreparar && elegidas.length > 0 && (
                <Box paddingTop={4}>
                  <Typography>Seleccionado: <strong>{dinero(totalElegido)}</strong> (estimado, IVA incluido)</Typography>
                </Box>
              )}
            </Tarjeta>
          </Flex>
        )}
      </Layouts.Content>
    </Page.Main>
  );
}
