import * as React from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { Page, Layouts, BackButton } from '@strapi/strapi/admin';
import {
  Flex, Typography, Table, Thead, Tbody, Tr, Th, Td, Button, IconButton, TextInput, Textarea, Field,
  SingleSelect, SingleSelectOption, Loader, Alert, Link, Box, Grid,
} from '@strapi/design-system';
import { Trash, Plus, Eye, Download } from '@strapi/icons';
import { usePermisos, useFactura, useBusquedas } from '../../application/useFacturacion';
import {
  dinero, fecha, fechaHora, cantidad, iva, ESTADO_FACTURA, ESTADO_PAGO, TIPO_RENGLON, UNIDAD,
} from '../../domain/formato';
import { Insignia, Tarjeta, Dato, Totales, RUTA } from '../components/comunes';
import { ModalEmitir, ModalAnular, ModalBorrar, ModalAgregar } from '../components/modales';

/**
 * Celda numérica que guarda al salir del campo, y solo si cambió: cada
 * guardado recalcula la factura en el servidor.
 */
function CeldaNumero({ valor, onGuardar, etiqueta, deshabilitada }) {
  const [texto, setTexto] = React.useState(String(valor ?? 0));
  React.useEffect(() => setTexto(String(valor ?? 0)), [valor]);
  return (
    <TextInput
      aria-label={etiqueta}
      type="number"
      min={0}
      size="S"
      value={texto}
      disabled={deshabilitada}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { if (Number(texto) !== Number(valor)) onGuardar(Number(texto)); }}
      style={{ maxWidth: 110 }}
    />
  );
}

export function FacturaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const permisos = usePermisos() ?? {};
  const f = useFactura(id);
  const busquedas = useBusquedas();
  const factura = f.datos;
  const [modal, setModal] = React.useState(null); // 'emitir' | 'anular' | 'borrar' | 'agregar'
  const [notas, setNotas] = React.useState('');
  React.useEffect(() => setNotas(factura?.notas ?? ''), [factura?.notas]);

  const borrador = factura?.estado === 'draft';
  const editable = borrador && permisos.puedePreparar;
  const emitida = ['issued', 'dian_error'].includes(factura?.estado);
  const nombrePdf = factura?.numero ? `Factura-${factura.numero}.pdf` : `Borrador-${id}.pdf`;

  const acciones = factura && (
    <Flex gap={2} wrap="wrap">
      <Button variant="tertiary" startIcon={<Eye />} onClick={() => f.pdf(false)}>{borrador ? 'Vista previa' : 'Ver PDF'}</Button>
      {!borrador && <Button variant="tertiary" startIcon={<Download />} onClick={() => f.pdf(true, nombrePdf)}>Descargar</Button>}
      {borrador && permisos.puedePreparar && <Button variant="danger-light" onClick={() => setModal('borrar')}>Eliminar borrador</Button>}
      {emitida && permisos.puedeAnular && <Button variant="danger-light" onClick={() => setModal('anular')}>Anular</Button>}
      {borrador && permisos.puedeEmitir && (
        <Button disabled={factura.renglones.length === 0} onClick={() => setModal('emitir')}>Emitir factura</Button>
      )}
    </Flex>
  );

  return (
    <Page.Main>
      <Layouts.Header
        navigationAction={<BackButton fallback={RUTA} />}
        title={factura ? (factura.numero ? `Factura ${factura.numero}` : 'Borrador de factura') : 'Factura'}
        subtitle={factura?.cliente?.nombre}
        primaryAction={acciones}
      />
      <Layouts.Content>
        {f.cargando && !factura && <Flex justifyContent="center" padding={8}><Loader>Cargando la factura…</Loader></Flex>}
        {f.error && <Alert variant="danger" title="No se pudo cargar la factura">{f.error}</Alert>}
        {factura && (
          <Flex direction="column" gap={4} alignItems="stretch">
            {factura.estado === 'voided' && (
              <Alert variant="danger" title={`Anulada el ${fechaHora(factura.anuladaEl)}`}>
                {factura.motivoAnulacion}. Sus conceptos volvieron a quedar pendientes de cobro.
              </Alert>
            )}
            {factura.estado === 'dian_error' && (
              <Alert variant="danger" title="Rechazada por la DIAN">Revisa el estado DIAN en la factura y vuelve a enviarla o anúlala.</Alert>
            )}

            <Grid.Root gap={4}>
              <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                <Tarjeta titulo="Documento">
                  <Flex direction="column" gap={2} alignItems="stretch">
                    <Dato etiqueta="Estado"><Insignia estado={factura.estado} mapa={ESTADO_FACTURA} /></Dato>
                    {!borrador && <Dato etiqueta="Pago"><Insignia estado={factura.pago} mapa={ESTADO_PAGO} /></Dato>}
                    <Dato etiqueta={borrador ? 'Creado' : 'Emitida'}>{fechaHora(factura.emitidaEl ?? factura.creadaEl)}</Dato>
                    {factura.venceEl && <Dato etiqueta="Vence">{fecha(factura.venceEl)}</Dato>}
                    {factura.resolucion && (
                      <Dato etiqueta="Resolución DIAN">{factura.resolucion.numero}</Dato>
                    )}
                    {emitida && permisos.puedeEmitir && (
                      <Field.Root name="pago">
                        <Field.Label>Registrar pago</Field.Label>
                        <SingleSelect value={factura.pago} onChange={(v) => f.registrarPago(v)} disabled={f.ocupado}>
                          {Object.entries(ESTADO_PAGO).map(([k, v]) => <SingleSelectOption key={k} value={k}>{v.rotulo}</SingleSelectOption>)}
                        </SingleSelect>
                      </Field.Root>
                    )}
                  </Flex>
                </Tarjeta>
              </Grid.Item>
              <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                <Tarjeta titulo="Cliente">
                  <Flex direction="column" gap={2} alignItems="stretch">
                    {/* Emitida: los datos congelados. Borrador: la ficha actual. */}
                    <Dato etiqueta="Nombre">{factura.comprador?.name ?? factura.cliente?.nombre}</Dato>
                    <Dato etiqueta="Documento">
                      {factura.comprador?.documentNumber ? `${factura.comprador.documentType ?? ''} ${factura.comprador.documentNumber}` : factura.cliente?.documento}
                    </Dato>
                    {factura.comprador?.address && <Dato etiqueta="Dirección">{factura.comprador.address}</Dato>}
                    {factura.comprador?.email && <Dato etiqueta="Correo">{factura.comprador.email}</Dato>}
                    {borrador && (
                      <Typography variant="pi" textColor="neutral600">
                        Los datos del cliente y de la clínica se congelan al emitir.
                      </Typography>
                    )}
                  </Flex>
                </Tarjeta>
              </Grid.Item>
            </Grid.Root>

            <Tarjeta
              titulo="Conceptos"
              acciones={editable && (
                <Button variant="secondary" startIcon={<Plus />} onClick={() => setModal('agregar')}>Añadir conceptos</Button>
              )}
            >
              {factura.renglones.length === 0 ? (
                <Typography textColor="neutral600">El borrador no tiene conceptos. Añádelos del catálogo o de las consultas del cliente.</Typography>
              ) : (
                <Table colCount={editable ? 8 : 7} rowCount={factura.renglones.length + 1}>
                  <Thead>
                    <Tr>
                      {['Concepto', 'Cant.', 'V. unitario', 'Descuento', 'IVA', 'Subtotal', 'Total', ...(editable ? [''] : [])].map((c, i) => (
                        <Th key={`${c}-${i}`}><Typography variant="sigma">{c}</Typography></Th>
                      ))}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {factura.renglones.map((r) => (
                      <Tr key={r.documentId}>
                        <Td>
                          <Typography fontWeight="bold">{r.descripcion}</Typography>
                          <Box>
                            <Typography variant="pi" textColor="neutral600">
                              {TIPO_RENGLON[r.kind] ?? r.kind}
                              {r.consulta && (
                                <> · <Link tag={RouterLink} to={`${RUTA}/consultas/${r.consulta.documentId}`}>
                                  consulta del {fecha(r.consulta.fecha)}{r.consulta.mascota ? ` · ${r.consulta.mascota}` : ''}
                                </Link></>
                              )}
                            </Typography>
                          </Box>
                        </Td>
                        <Td>
                          {editable && r.cantidadEditable
                            ? <CeldaNumero etiqueta="Cantidad" valor={r.cantidad} onGuardar={(v) => f.cambiarRenglon(r.documentId, { cantidad: v })} deshabilitada={f.ocupado} />
                            : <Typography>{cantidad(r.cantidad)} {UNIDAD[r.unidad] ?? r.unidad ?? ''}</Typography>}
                        </Td>
                        <Td>
                          {editable && permisos.puedeEmitir
                            ? <CeldaNumero etiqueta="Precio unitario" valor={r.precioUnitario} onGuardar={(v) => f.cambiarRenglon(r.documentId, { precioUnitario: v })} deshabilitada={f.ocupado} />
                            : <Typography>{dinero(r.precioUnitario, factura.moneda)}</Typography>}
                        </Td>
                        <Td>
                          {editable
                            ? <CeldaNumero etiqueta="Descuento" valor={r.descuento} onGuardar={(v) => f.cambiarRenglon(r.documentId, { descuento: v })} deshabilitada={f.ocupado} />
                            : <Typography>{r.descuento ? dinero(r.descuento, factura.moneda) : '—'}</Typography>}
                        </Td>
                        <Td><Typography>{iva(r.tratamiento, r.tarifa)}</Typography></Td>
                        <Td><Typography>{dinero(r.subtotal, factura.moneda)}</Typography></Td>
                        <Td><Typography fontWeight="bold">{dinero(r.total, factura.moneda)}</Typography></Td>
                        {editable && (
                          <Td>
                            <IconButton label="Quitar concepto" variant="ghost" onClick={() => f.quitarRenglon(r.documentId)} disabled={f.ocupado}>
                              <Trash />
                            </IconButton>
                          </Td>
                        )}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
              <Flex justifyContent="flex-end" paddingTop={6}>
                <Totales factura={factura} />
              </Flex>
              {editable && (
                <Box paddingTop={2}>
                  <Typography variant="pi" textColor="neutral600">
                    El precio y el IVA se copiaron del catálogo al añadir cada concepto.
                    {permisos.puedeEmitir ? '' : ' Cambiar un precio requiere el permiso de emitir.'}
                    {' '}Una cortesía se factura con descuento del 100 %.
                  </Typography>
                </Box>
              )}
            </Tarjeta>

            <Tarjeta titulo="Observaciones">
              {editable ? (
                <Flex direction="column" gap={2} alignItems="stretch">
                  <Textarea aria-label="Observaciones" value={notas} onChange={(e) => setNotas(e.target.value)} />
                  <Flex justifyContent="flex-end">
                    <Button variant="secondary" disabled={notas === (factura.notas ?? '') || f.ocupado} onClick={() => f.guardarDatos({ notas })}>
                      Guardar observaciones
                    </Button>
                  </Flex>
                </Flex>
              ) : (
                <Typography>{factura.notas || '—'}</Typography>
              )}
            </Tarjeta>
          </Flex>
        )}
      </Layouts.Content>

      {factura && (
        <>
          <ModalEmitir abierto={modal === 'emitir'} onCerrar={() => setModal(null)} factura={factura} ocupado={f.ocupado} onEmitir={f.emitir} />
          <ModalAnular abierto={modal === 'anular'} onCerrar={() => setModal(null)} factura={factura} ocupado={f.ocupado} onAnular={f.anular} />
          <ModalBorrar abierto={modal === 'borrar'} onCerrar={() => setModal(null)}
            onBorrar={async () => { const ok = await f.borrar(); if (ok) navigate(RUTA); return ok; }} />
          <ModalAgregar abierto={modal === 'agregar'} onCerrar={() => setModal(null)} factura={factura} busquedas={busquedas}
            onAgregarDirecto={f.agregarDirecto} onAgregarConceptos={f.agregarConceptos} />
        </>
      )}
    </Page.Main>
  );
}
