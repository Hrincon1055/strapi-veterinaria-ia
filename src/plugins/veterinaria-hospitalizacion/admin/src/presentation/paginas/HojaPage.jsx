import * as React from 'react';
import { useParams, useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Page, Layouts, BackButton } from '@strapi/strapi/admin';
import {
  Box, Flex, Grid, Typography, Button, Alert, Link, Checkbox, Divider, SimpleMenu, MenuItem, IconButton,
} from '@strapi/design-system';
import { ChevronLeft, ChevronRight, Plus, PriceTag, File, SignOut, ArrowRight, Heart } from '@strapi/icons';
import { useHospitalizacionStore } from '../store';
import { usePermisos, useHoja, useBusquedas } from '../../application/useHospitalizacion';
import { GRAVEDAD, TIPO_ALTA, VIA, ESTADO_TOMA, diaLargo, dias, numero } from '../../domain/formato';
import { Insignia, Tarjeta, Dato, Estado, RUTA, rutaHoja } from '../components/comunes';
import { Rejilla } from '../components/Rejilla';
import { ModalSignos, ModalToma, ModalDosisUnica, ModalOrden, ModalSuspender, ModalTraslado, ModalAlta } from '../components/modales';
import { Impresion } from '../components/Impresion';
import { ResumenAlta } from '../components/ResumenAlta';

const FACTURACION = '/plugins/veterinaria-facturacion';

/**
 * Hoja de evolución de una hospitalización, día por día (`?dia=AAAA-MM-DD`).
 *
 * Qué se ve depende del permiso, y el servidor vuelve a comprobarlo en cada
 * escritura: el auxiliar registra tomas y signos; el veterinario además
 * prescribe, traslada y da el alta; recepción solo mira (y factura).
 */
export function HojaPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const dia = params.get('dia') ?? undefined;
  const permisos = usePermisos();
  const busquedas = useBusquedas();
  const { verOrdenesCerradas, setVerOrdenesCerradas } = useHospitalizacionStore();
  const hoja = useHoja(id, dia);
  const h = hoja.datos;

  const [modal, setModal] = React.useState(null); // 'signos' | 'orden' | 'dosis' | 'traslado' | 'alta'
  const [toma, setToma] = React.useState(null); // { orden, toma }
  const [suspender, setSuspender] = React.useState(null);
  const cerrar = () => setModal(null);
  const tras = (ok, fn) => { if (ok) fn(); };

  const activa = h?.hospitalizacion.estado === 'active';
  const puedeRegistrar = Boolean(permisos?.puedeRegistrar);
  const puedePrescribir = Boolean(permisos?.puedePrescribir) && activa;
  const irADia = (d) => setParams(d ? { dia: d } : {});

  const acciones = h && (
    <Flex gap={2} wrap="wrap">
      {puedeRegistrar && (
        <SimpleMenu label="Registrar" variant="secondary">
          <MenuItem onSelect={() => setModal('signos')} startIcon={<Heart />}>Signos y evolución</MenuItem>
          <MenuItem onSelect={() => setModal('dosis')} startIcon={<Plus />}>Dosis única o «si es necesario»</MenuItem>
        </SimpleMenu>
      )}
      {puedePrescribir && (
        <SimpleMenu label="Veterinario" variant="secondary">
          <MenuItem onSelect={() => setModal('orden')} startIcon={<Plus />}>Nueva orden de tratamiento</MenuItem>
          <MenuItem onSelect={() => setModal('traslado')} startIcon={<ArrowRight />}>Trasladar de jaula</MenuItem>
          <MenuItem onSelect={() => setModal('alta')} startIcon={<SignOut />}>Dar el alta</MenuItem>
        </SimpleMenu>
      )}
      {permisos?.puedeFacturar && (
        <Button variant="tertiary" startIcon={<PriceTag />} onClick={() => navigate(`${FACTURACION}/hospitalizaciones/${id}`)}>Facturar</Button>
      )}
      {!activa && h.hospitalizacion.alta && (
        <Button variant="tertiary" startIcon={<File />} onClick={() => window.print()}>Imprimir alta</Button>
      )}
    </Flex>
  );

  return (
    <Page.Main>
      <Page.Title>{h?.mascota ? `Hospitalización de ${h.mascota.nombre}` : 'Hospitalización'}</Page.Title>
      <Layouts.Header
        navigationAction={<BackButton fallback={RUTA} />}
        title={h?.mascota ? `${h.mascota.nombre}${h.hospitalizacion.jaula ? ` · ${h.hospitalizacion.jaula.nombre}` : ''}` : 'Hospitalización'}
        subtitle={h ? `${activa ? 'Ingresado' : 'Alta'} · ${dias(h.hospitalizacion.dias)} · ingreso ${h.hospitalizacion.ingresoTexto}` : undefined}
        primaryAction={acciones}
      />
      <Layouts.Content>
        <Estado cargando={hoja.cargando} error={hoja.error}>
          {h && (
            <Flex direction="column" gap={4} alignItems="stretch">
              {h.alergias.length > 0 && (
                <Alert variant="danger" title="Alergias activas">
                  {h.alergias.map((a) => `${a.alergeno}${a.gravedad ? ` (${GRAVEDAD[a.gravedad] ?? a.gravedad})` : ''}${a.reaccion ? `: ${a.reaccion}` : ''}`).join(' · ')}
                </Alert>
              )}
              {!activa && h.hospitalizacion.alta && (
                <Alert variant="success" title={`${TIPO_ALTA[h.hospitalizacion.alta.tipo] ?? 'Alta'} · ${h.hospitalizacion.alta.fechaTexto}`}>
                  {h.hospitalizacion.alta.por ? `Dada por ${h.hospitalizacion.alta.por}. ` : ''}La hoja queda como historia: las tomas y los signos se pueden consultar día por día.
                </Alert>
              )}

              <Grid.Root gap={4}>
                <Grid.Item col={4} s={12} direction="column" alignItems="stretch">
                  <Tarjeta titulo="Paciente" padding={5}>
                    <Flex direction="column" gap={2} alignItems="stretch">
                      <Dato etiqueta="Especie / raza">{[h.mascota?.especie, h.mascota?.raza].filter(Boolean).join(' · ') || '—'}</Dato>
                      <Dato etiqueta="Peso">{h.mascota?.pesoKg ? `${numero(h.mascota.pesoKg, 2)} kg` : '—'}</Dato>
                      <Dato etiqueta="Propietario">{h.propietario?.nombre}</Dato>
                      <Dato etiqueta="Teléfono">{h.propietario?.telefono}</Dato>
                      <Divider />
                      <Link tag={RouterLink} to={`/content-manager/collection-types/api::pet.pet/${h.mascota?.documentId}`}>Ficha de la mascota</Link>
                    </Flex>
                  </Tarjeta>
                </Grid.Item>
                <Grid.Item col={8} s={12} direction="column" alignItems="stretch">
                  <Tarjeta titulo="Ingreso" padding={5}>
                    <Grid.Root gap={4}>
                      <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                        <Flex direction="column" gap={2} alignItems="stretch">
                          <Dato etiqueta="Veterinario responsable">{h.hospitalizacion.veterinario}</Dato>
                          <Dato etiqueta="Ingresado por">{h.hospitalizacion.ingresadoPor}</Dato>
                          <Dato etiqueta="Jaula">{h.hospitalizacion.jaula ? `${h.hospitalizacion.jaula.nombre}${h.hospitalizacion.jaula.sala ? ` · ${h.hospitalizacion.jaula.sala}` : ''}` : '—'}</Dato>
                          {h.hospitalizacion.consulta && (
                            <Link tag={RouterLink} to={`/content-manager/collection-types/api::clinical.consultation/${h.hospitalizacion.consulta.documentId}`}>
                              Consulta de origen
                            </Link>
                          )}
                        </Flex>
                      </Grid.Item>
                      <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                        <Typography variant="pi" fontWeight="bold">Motivo</Typography>
                        <Typography variant="pi">{h.hospitalizacion.motivo}</Typography>
                        {h.hospitalizacion.notasIngreso && (
                          <Box paddingTop={2}><Typography variant="pi" textColor="neutral600" style={{ whiteSpace: 'pre-line' }}>{h.hospitalizacion.notasIngreso}</Typography></Box>
                        )}
                      </Grid.Item>
                    </Grid.Root>
                  </Tarjeta>
                </Grid.Item>
              </Grid.Root>

              <Tarjeta
                titulo={`Hoja del ${diaLargo(h.dia)}${h.esHoy ? ' (hoy)' : ''}`}
                subtitulo={`${h.resumen.dadas} dada(s) · ${h.resumen.omitidas} omitida(s) · ${h.resumen.pendientes} pendiente(s)${h.resumen.atrasadas ? ` · ${h.resumen.atrasadas} atrasada(s)` : ''} · horas de la clínica`}
                acciones={(
                  <>
                    <IconButton label="Día anterior" disabled={!h.diaAnterior} onClick={() => irADia(h.diaAnterior)}><ChevronLeft /></IconButton>
                    <Button variant="tertiary" disabled={h.esHoy || (!activa && !h.diaSiguiente)} onClick={() => irADia(undefined)}>{activa ? 'Hoy' : 'Último día'}</Button>
                    <IconButton label="Día siguiente" disabled={!h.diaSiguiente} onClick={() => irADia(h.diaSiguiente)}><ChevronRight /></IconButton>
                  </>
                )}
              >
                <Flex direction="column" gap={3} alignItems="stretch">
                  <Rejilla
                    hoja={h}
                    puedeRegistrar={puedeRegistrar}
                    puedePrescribir={puedePrescribir}
                    verCerradas={verOrdenesCerradas}
                    onTomar={(orden, t) => setToma({ orden, toma: t })}
                    onSuspender={setSuspender}
                  />
                  <Flex justifyContent="space-between" wrap="wrap" gap={2}>
                    <Flex gap={3} wrap="wrap">
                      {Object.entries(ESTADO_TOMA).map(([k, v]) => <Insignia key={k} estado={k} mapa={ESTADO_TOMA}>{v.rotulo}</Insignia>)}
                      <Typography variant="pi" textColor="neutral600">Atrasada: más de una hora sin registrar.{puedeRegistrar ? ' Pulsa una toma para registrarla.' : ''}</Typography>
                    </Flex>
                    <Checkbox checked={verOrdenesCerradas} onCheckedChange={(v) => setVerOrdenesCerradas(Boolean(v))}>
                      Ver órdenes suspendidas y terminadas
                    </Checkbox>
                  </Flex>
                </Flex>
              </Tarjeta>

              <Grid.Root gap={4}>
                <Grid.Item col={7} s={12} direction="column" alignItems="stretch">
                  <Tarjeta titulo="Órdenes de tratamiento" padding={5}>
                    {h.ordenes.length === 0 ? <Typography textColor="neutral600">Ninguna vigente este día.</Typography> : (
                      <Flex direction="column" gap={3} alignItems="stretch">
                        {h.ordenes.map((o) => (
                          <Box key={o.documentId}>
                            <Flex gap={2}>
                              <Typography fontWeight="bold">{o.producto?.nombre}</Typography>
                              {o.estado !== 'active' && <Insignia estado={o.estado} mapa={{ suspended: { rotulo: 'Suspendida', color: 'neutral' }, completed: { rotulo: 'Terminada', color: 'neutral' } }} />}
                            </Flex>
                            <Typography variant="pi" textColor="neutral600">
                              {[o.dosis, VIA[o.via], o.siEsNecesario ? 'si es necesario' : `cada ${o.cadaHoras} h`, `desde ${o.desdeTexto}`, o.hastaTexto ? `hasta ${o.hastaTexto}` : null, o.prescritaPor ? `· ${o.prescritaPor}` : null].filter(Boolean).join(' · ')}
                            </Typography>
                            {o.notas && <Typography variant="pi" style={{ whiteSpace: 'pre-line' }}>{o.notas}</Typography>}
                          </Box>
                        ))}
                      </Flex>
                    )}
                  </Tarjeta>
                </Grid.Item>
                <Grid.Item col={5} s={12} direction="column" alignItems="stretch">
                  <Tarjeta titulo="Observaciones del día" padding={5}>
                    {h.signos.filter((s) => s.notas).length === 0 ? <Typography textColor="neutral600">Sin observaciones.</Typography> : (
                      <Flex direction="column" gap={2} alignItems="stretch">
                        {h.signos.filter((s) => s.notas).map((s) => (
                          <Box key={s.documentId}>
                            <Typography variant="pi" fontWeight="bold">{s.horaTexto}{s.por ? ` · ${s.por}` : ''}</Typography>
                            <Typography variant="pi" style={{ whiteSpace: 'pre-line' }}> {s.notas}</Typography>
                          </Box>
                        ))}
                      </Flex>
                    )}
                    {h.hospitalizacion.traslados.length > 1 && (
                      <Box paddingTop={4}>
                        <Typography variant="sigma">Traslados</Typography>
                        {h.hospitalizacion.traslados.map((t, i) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <Typography key={i} variant="pi" tag="p">{t.jaula}: {t.desde} → {t.hasta ?? 'ahora'}</Typography>
                        ))}
                      </Box>
                    )}
                  </Tarjeta>
                </Grid.Item>
              </Grid.Root>
            </Flex>
          )}
        </Estado>
      </Layouts.Content>

      {h && (
        <>
          <ModalSignos abierto={modal === 'signos'} onCerrar={cerrar} ocupado={hoja.ocupado} esHoy={h.esHoy}
            onRegistrar={async (d) => tras(await hoja.registrarSignos(d), cerrar)} />
          <ModalDosisUnica abierto={modal === 'dosis'} onCerrar={cerrar} ocupado={hoja.ocupado} esHoy={h.esHoy} busquedas={busquedas}
            ordenesPrn={h.ordenes.filter((o) => o.siEsNecesario && o.estado === 'active')}
            onRegistrar={async (d) => tras(await hoja.registrarToma(d), cerrar)} />
          <ModalToma toma={toma} onCerrar={() => setToma(null)} ocupado={hoja.ocupado} esHoy={h.esHoy}
            onRegistrar={async (d) => tras(await hoja.registrarToma(d), () => setToma(null))} />
          <ModalOrden abierto={modal === 'orden'} onCerrar={cerrar} ocupado={hoja.ocupado} busquedas={busquedas}
            onPrescribir={async (d) => tras(await hoja.prescribir(d), cerrar)} />
          <ModalSuspender orden={suspender} onCerrar={() => setSuspender(null)} ocupado={hoja.ocupado}
            onSuspender={async (o, m) => tras(await hoja.suspender(o, m), () => setSuspender(null))} />
          <ModalTraslado abierto={modal === 'traslado'} onCerrar={cerrar} ocupado={hoja.ocupado} busquedas={busquedas}
            jaulaActual={h.hospitalizacion.jaula?.nombre} onTrasladar={async (j) => tras(await hoja.trasladar(j), cerrar)} />
          <ModalAlta abierto={modal === 'alta'} onCerrar={cerrar} ocupado={hoja.ocupado} mascota={h.mascota?.nombre}
            onDarAlta={async (d) => tras(await hoja.darAlta(d), cerrar)} />
          {!activa && h.hospitalizacion.alta && (
            <Impresion><ResumenAlta hoja={h} /></Impresion>
          )}
        </>
      )}
    </Page.Main>
  );
}

