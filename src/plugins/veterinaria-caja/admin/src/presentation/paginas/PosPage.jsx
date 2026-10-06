import * as React from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Flex, Typography, Button, TextInput, Loader, Alert, Badge, IconButton, SimpleMenu, MenuItem,
} from '@strapi/design-system';
import { House, ChevronRight, Search, User, Lock, Trash, ShoppingCart, Monitor, List, Cross } from '@strapi/icons';
import { useCajaStore } from '../store';
import { useSesion, useOperacion, useCarga } from '../../application/useCaja';
import { dinero, hora, cantidad, UNIDAD, totalesDelTicket, importeDeLinea, aRenglon } from '../../domain/formato';
import {
  Pantalla, Barra, Cuerpo, Columna, Desplazable, LineaTicket, Teclado, Tecla, Rejilla, Tarjeta, Imagen, Total,
} from '../components/estilos';
import { Apertura, ModalCierre } from '../components/Turno';
import { ModalCobro } from '../components/Cobro';
import {
  ModalCliente, ModalPendientes, ModalCartera, ModalMovimiento, ModalDevolucion, ModalTurno, ModalSupervision,
} from '../components/modales';
import { Impresion } from '../components/Impresion';
import { Recibo, InformeCierre } from '../components/Documentos';

/**
 * El punto de venta a pantalla completa (sección 5.7). Se abre en una pestaña
 * propia desde el menú del panel y tapa la navegación de Strapi; la sesión es
 * la misma del panel.
 *
 * Sin turno abierto muestra la apertura; con turno, la venta: ticket con
 * teclado a la izquierda y catálogo a la derecha, como un POS de mostrador.
 */

const iniciales = (n) => String(n ?? '?').split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

function Catalogo({ api }) {
  const { categoria, setCategoria, busqueda, setBusqueda, agregarItem } = useCajaStore();
  const [texto, setTexto] = React.useState(busqueda);
  React.useEffect(() => { const t = setTimeout(() => setBusqueda(texto), 250); return () => clearTimeout(t); }, [texto, setBusqueda]);
  const { datos, cargando, error } = useCarga(() => api.catalogo({ categoria: categoria?.documentId, q: busqueda }), [api, categoria?.documentId, busqueda]);

  return (
    <Columna>
      <Flex padding={3} gap={3} background="neutral0" style={{ borderBottom: '1px solid var(--borde, transparent)' }} wrap="wrap">
        <IconButton label="Todas las categorías" onClick={() => setCategoria(null)}><House /></IconButton>
        {categoria && (<><ChevronRight /><Typography fontWeight="bold">{categoria.nombre}</Typography></>)}
        <Box style={{ flex: 1 }} />
        <Box style={{ minWidth: 240 }}>
          <TextInput aria-label="Buscar productos" startAction={<Search />} placeholder="Buscar productos y servicios" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Box>
      </Flex>
      {!categoria && datos?.categorias && (
        <Flex gap={2} padding={3} wrap="wrap">
          {datos.categorias.map((c) => (
            <Button key={c.documentId} variant="secondary" onClick={() => setCategoria(c)}>{c.nombre}</Button>
          ))}
        </Flex>
      )}
      <Desplazable>
        {cargando && <Flex justifyContent="center" padding={8}><Loader>Cargando catálogo…</Loader></Flex>}
        {error && <Box padding={4}><Alert variant="danger" title="No se pudo cargar">{error}</Alert></Box>}
        <Rejilla>
          {(datos?.items ?? []).map((it) => (
            <Tarjeta key={`${it.relacion}-${it.documentId}`} type="button" disabled={Boolean(it.problema)} title={it.problema ?? it.nombre}
              onClick={() => agregarItem(it)}>
              <Imagen $color={it.relacion === 'service' ? it.color ?? undefined : undefined}>
                {it.imagen ? <img src={it.imagen} alt="" /> : <span>{iniciales(it.nombre)}</span>}
              </Imagen>
              <Box padding={2} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Typography fontWeight="bold" variant="omega" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.nombre}</Typography>
                <Typography variant="pi" textColor={it.problema ? 'danger600' : 'primary700'} fontWeight="bold">
                  {it.problema ?? `${dinero(it.precioConIva)}${it.unidad && it.unidad !== 'unit' && it.unidad !== 'servicio' ? ` / ${UNIDAD[it.unidad] ?? it.unidad}` : ''}`}
                </Typography>
              </Box>
            </Tarjeta>
          ))}
        </Rejilla>
        {datos && datos.items.length === 0 && <Box padding={6}><Typography textColor="neutral600">Nada coincide.</Typography></Box>}
      </Desplazable>
    </Columna>
  );
}

function Ticket({ clienteInfo, onCliente, onPendientes, onAbonarCliente, onAnticipo, onCobrar }) {
  const { lineas, seleccionada, seleccionar, modo, setModo, teclear, quitarLinea, cliente, vaciar } = useCajaStore();
  const t = totalesDelTicket(lineas);
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'borrar'];
  return (
    <Columna $fondo $borde>
      <Desplazable>
        {lineas.length === 0 && (
          <Flex direction="column" padding={8} gap={2} alignItems="center">
            <ShoppingCart width="3.2rem" height="3.2rem" />
            <Typography textColor="neutral600">Toca un producto o servicio para empezar la venta.</Typography>
          </Flex>
        )}
        {lineas.map((l) => {
          const i = importeDeLinea(l);
          return (
            <LineaTicket key={l.clave} type="button" $activa={seleccionada === l.clave} onClick={() => seleccionar(l.clave)}>
              <Flex justifyContent="space-between" gap={2}>
                <Typography fontWeight="bold">{l.nombre}</Typography>
                <Typography fontWeight="bold">{dinero(i.total)}</Typography>
              </Flex>
              <Typography variant="pi" textColor="neutral600">
                {cantidad(l.cantidad)} {l.tipo === 'concepto' ? `· ${l.origen}` : `${UNIDAD[l.unidad] ?? ''} x ${dinero(l.precio)}${l.iva ? ` + IVA ${l.iva} %` : ''}`}
                {l.descuentoPct > 0 ? ` · descuento ${cantidad(l.descuentoPct)} %` : ''}
              </Typography>
            </LineaTicket>
          );
        })}
      </Desplazable>

      <Total>
        <Typography variant="beta" tag="p">Total: {dinero(t.total)}</Typography>
        <Typography variant="pi" textColor="neutral600" tag="p">IVA {dinero(t.impuesto)}{t.descuentos ? ` · descuentos ${dinero(t.descuentos)}` : ''} · estimado con el catálogo de hoy</Typography>
      </Total>

      {clienteInfo && !clienteInfo.consumidorFinal && (clienteInfo.pendientes.length > 0 || clienteInfo.saldoEnCartera > 0 || clienteInfo.saldoAFavor > 0) && (
        <Flex padding={3} gap={2} wrap="wrap" background="warning100">
          {clienteInfo.pendientes.length > 0 && <Button size="S" variant="secondary" onClick={onPendientes}>{clienteInfo.pendientes.length} origen(es) por cobrar</Button>}
          {clienteInfo.saldoEnCartera > 0 && <Button size="S" variant="secondary" onClick={onAbonarCliente}>Cartera {dinero(clienteInfo.saldoEnCartera)}</Button>}
          {clienteInfo.saldoAFavor > 0 && <Badge backgroundColor="success100" textColor="success700">A favor {dinero(clienteInfo.saldoAFavor)}</Badge>}
        </Flex>
      )}

      <Teclado>
        <Tecla type="button" onClick={onCliente} style={{ gridRow: 'span 1', justifyContent: 'flex-start', paddingLeft: 12 }}>
          <User /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente?.etiqueta ?? 'Consumidor final'}</span>
        </Tecla>
        {teclas.slice(0, 3).map((k) => <Tecla key={k} type="button" disabled={!seleccionada} onClick={() => teclear(k)}>{k}</Tecla>)}
        <Tecla type="button" $activa={modo === 'cantidad'} onClick={() => setModo('cantidad')}>Cant.</Tecla>

        <Tecla type="button" $cobrar disabled={lineas.length === 0} onClick={onCobrar}>
          <ChevronRight />
          Cobrar
        </Tecla>
        {teclas.slice(3, 6).map((k) => <Tecla key={k} type="button" disabled={!seleccionada} onClick={() => teclear(k)}>{k}</Tecla>)}
        <Tecla type="button" $activa={modo === 'descuento'} onClick={() => setModo('descuento')}>% Desc.</Tecla>
        {teclas.slice(6, 9).map((k) => <Tecla key={k} type="button" disabled={!seleccionada} onClick={() => teclear(k)}>{k}</Tecla>)}
        <Tecla type="button" disabled={!seleccionada} onClick={() => quitarLinea(seleccionada)} title="Quitar la línea"><Trash /></Tecla>
        <Tecla type="button" disabled={!seleccionada} onClick={() => teclear('.')}>.</Tecla>
        <Tecla type="button" disabled={!seleccionada} onClick={() => teclear('0')}>0</Tecla>
        <Tecla type="button" disabled={!seleccionada} onClick={() => teclear('borrar')} aria-label="Borrar">⌫</Tecla>
        <Tecla type="button" disabled={lineas.length === 0 && !cliente} onClick={vaciar} title="Vaciar el ticket"><Cross /></Tecla>
      </Teclado>
      {cliente && !cliente.consumidorFinal && (
        <Flex padding={2} gap={2} justifyContent="flex-end" style={{ borderTop: '1px solid transparent' }}>
          <Button size="S" variant="tertiary" onClick={onAnticipo}>Recibir anticipo</Button>
        </Flex>
      )}
    </Columna>
  );
}

export function PosPage() {
  const [params, setParams] = useSearchParams();
  const sesion = useSesion();
  const { api, ejecutar, ocupado } = useOperacion();
  const { lineas, cliente, setCliente, agregarConcepto, vaciar } = useCajaStore();
  const me = sesion.datos;
  const turno = me?.turno;
  const cajas = useCarga(() => api.cajas(), [api, turno?.documentId], { activo: Boolean(me) && !turno });

  const [modal, setModal] = React.useState(null);
  const [cobro, setCobro] = React.useState(null); // { modo, total, titulo, factura? }
  const [recibo, setRecibo] = React.useState(null);
  const [cierre, setCierre] = React.useState(null);
  const [clienteInfo, setClienteInfo] = React.useState(null);

  // El cliente elegido: lo que tiene pendiente, en cartera y a favor.
  const cargarCliente = React.useCallback(async (c) => {
    setClienteInfo(c && !c.consumidorFinal ? await api.cliente(c.documentId).catch(() => null) : null);
  }, [api]);
  React.useEffect(() => { cargarCliente(cliente); }, [cliente, cargarCliente]);

  // `?factura=` (desde Facturación → "Cobrar en caja"): abono directo a esa factura.
  React.useEffect(() => {
    const id = params.get('factura');
    if (!id || !turno) return;
    api.factura(id).then((r) => {
      if (r?.factura?.saldo > 0) setCobro({ modo: 'abono', total: r.factura.saldo, titulo: `Abono a ${r.factura.numero} · ${r.cliente}`, factura: r.factura.documentId });
    }).catch(() => null);
    setParams({});
  }, [params, turno, api, setParams]);

  const recargarTurno = () => sesion.recargar();

  const imprimir = (r) => {
    setRecibo(r);
    setTimeout(() => window.print(), 300);
  };

  const cobrar = async (pagos) => {
    let r = null;
    if (cobro.modo === 'venta') {
      r = await ejecutar((a) => a.cobrar({ cliente: cliente?.documentId, renglones: lineas.map(aRenglon), pagos }), 'Venta registrada');
      if (r) vaciar();
    } else if (cobro.modo === 'abono') {
      r = await ejecutar((a) => a.abonar({ factura: cobro.factura, pagos }), 'Abono registrado');
    } else {
      r = await ejecutar((a) => a.anticipo({ cliente: cliente.documentId, pagos }), 'Anticipo registrado');
    }
    if (r) {
      setCobro(null);
      imprimir(r);
      recargarTurno();
      if (cliente) cargarCliente(cliente);
    }
  };

  const contenido = (() => {
    if (sesion.cargando) return <Flex justifyContent="center" padding={10}><Loader>Cargando la caja…</Loader></Flex>;
    if (sesion.error) return <Box padding={8}><Alert variant="danger" title="No se pudo abrir la caja">{sesion.error}</Alert></Box>;
    if (!me?.puedeOperar && !me?.puedeSupervisar) {
      return <Box padding={8}><Alert variant="danger" title="Sin acceso">Tu cuenta no tiene permiso para operar la caja.</Alert></Box>;
    }
    if (cierre) {
      return (
        <Box padding={8} style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
          <Flex direction="column" gap={4} alignItems="stretch">
            <Typography variant="alpha" tag="h1">Caja cerrada</Typography>
            <Alert variant={cierre.descuadre === 0 ? 'success' : 'warning'} title={cierre.descuadre === 0 ? 'La caja cuadra' : `Descuadre de ${dinero(cierre.descuadre)}`}>
              Esperado {dinero(cierre.esperado)} · contado {dinero(cierre.contado)}{cierre.motivoDescuadre ? ` · ${cierre.motivoDescuadre}` : ''}
            </Alert>
            <Flex gap={2}>
              <Button onClick={() => window.print()}>Imprimir cierre</Button>
              <Button variant="secondary" onClick={() => { setCierre(null); recargarTurno(); }}>Abrir otro turno</Button>
              <Button variant="tertiary" onClick={() => window.close()}>Cerrar la pestaña</Button>
            </Flex>
          </Flex>
          <Impresion ancho="80mm"><InformeCierre turno={cierre} /></Impresion>
        </Box>
      );
    }
    if (!turno) {
      return (
        <Apertura cajas={cajas.datos} cargando={cajas.cargando} denominaciones={me.denominaciones} ocupado={ocupado} puedeOperar={me.puedeOperar}
          onAbrir={async (d) => { if (await ejecutar((a) => a.abrir(d), 'Caja abierta')) recargarTurno(); }} />
      );
    }
    return (
      <Cuerpo>
        <Ticket
          clienteInfo={clienteInfo}
          onCliente={() => setModal('cliente')}
          onPendientes={() => setModal('pendientes')}
          onAbonarCliente={() => setModal('carteraCliente')}
          onAnticipo={() => setCobro({ modo: 'anticipo', total: 0, titulo: `Anticipo de ${cliente?.etiqueta}` })}
          onCobrar={() => setCobro({ modo: 'venta', total: totalesDelTicket(lineas).total, titulo: `Cobrar a ${cliente?.etiqueta ?? 'Consumidor final'}` })}
        />
        <Catalogo api={api} />
      </Cuerpo>
    );
  })();

  return createPortal(
    <Pantalla role="application" aria-label="Punto de venta">
      <Barra>
        <Monitor />
        <Typography variant="delta" tag="h1">Punto de venta</Typography>
        {turno && (
          <>
            <Badge backgroundColor="success100" textColor="success700">{turno.caja?.nombre} · abierta {hora(turno.apertura)}</Badge>
            <Typography variant="pi" textColor="neutral600">{turno.responsable} · efectivo en caja {dinero(turno.esperado)}</Typography>
          </>
        )}
        <Box style={{ flex: 1 }} />
        {turno && (
          <>
            <Button variant="tertiary" startIcon={<List />} onClick={() => { recargarTurno(); setModal('turno'); }}>Turno</Button>
            <SimpleMenu label="Caja" variant="secondary">
              <MenuItem onSelect={() => setModal('movimiento')}>Movimiento de efectivo</MenuItem>
              <MenuItem onSelect={() => setModal('cartera')}>Cartera</MenuItem>
              {me?.puedeDevolver && <MenuItem onSelect={() => setModal('devolucion')}>Devolución</MenuItem>}
              {me?.puedeSupervisar && <MenuItem onSelect={() => setModal('supervision')}>Supervisión</MenuItem>}
            </SimpleMenu>
            <Button variant="danger-light" startIcon={<Lock />} onClick={() => { recargarTurno(); setModal('cierre'); }}>Cerrar caja</Button>
          </>
        )}
        {!turno && me?.puedeSupervisar && <Button variant="secondary" onClick={() => setModal('supervision')}>Supervisión</Button>}
        <Typography variant="pi" textColor="neutral600">{me?.cuenta?.nombre}</Typography>
      </Barra>

      {contenido}

      <ModalCliente abierto={modal === 'cliente'} onCerrar={() => setModal(null)} api={api}
        onElegir={(c) => { setCliente(c.consumidorFinal ? null : c); setModal(null); }} />
      <ModalPendientes abierto={modal === 'pendientes'} onCerrar={() => setModal(null)} api={api} pendientes={clienteInfo?.pendientes}
        onAgregar={(conceptos) => conceptos.forEach(agregarConcepto)} />
      <ModalCartera abierto={modal === 'cartera' || modal === 'carteraCliente'} onCerrar={() => setModal(null)} api={api}
        cliente={modal === 'carteraCliente' ? cliente?.documentId : null}
        onAbonar={(f) => { setModal(null); setCobro({ modo: 'abono', total: f.saldo, titulo: `Abono a ${f.numero} · ${f.cliente?.nombre ?? ''}`, factura: f.documentId }); }} />
      <ModalMovimiento abierto={modal === 'movimiento'} onCerrar={() => setModal(null)} api={api} ocupado={ocupado}
        onRegistrar={async (d) => { if (await ejecutar((a) => a.movimiento(d), 'Movimiento registrado')) { setModal(null); recargarTurno(); } }} />
      <ModalDevolucion abierto={modal === 'devolucion'} onCerrar={() => setModal(null)} api={api} ocupado={ocupado}
        onDevolver={async (d) => { const r = await ejecutar((a) => a.devolver(d), 'Devolución registrada'); if (r) { setModal(null); imprimir(r); recargarTurno(); } }} />
      <ModalTurno abierto={modal === 'turno'} onCerrar={() => setModal(null)} turno={turno} ocupado={ocupado}
        onReversar={async (id, motivo) => { const ok = await ejecutar((a) => a.reversar(id, motivo), 'Pago reversado'); if (ok) recargarTurno(); return ok; }} />
      <ModalSupervision abierto={modal === 'supervision'} onCerrar={() => setModal(null)} api={api} />
      {turno && (
        <ModalCierre abierto={modal === 'cierre'} onCerrar={() => setModal(null)} turno={turno} denominaciones={me.denominaciones} ocupado={ocupado}
          onCerrarCaja={async (d) => {
            const r = await ejecutar((a) => a.cerrar(turno.documentId, d), 'Caja cerrada');
            if (r) { setModal(null); vaciar(); setCierre(r); recargarTurno(); }
          }} />
      )}
      {cobro && (
        <ModalCobro abierto onCerrar={() => setCobro(null)} total={cobro.total} titulo={cobro.titulo} modo={cobro.modo} ocupado={ocupado}
          saldoAFavor={clienteInfo?.saldoAFavor ?? 0}
          permiteSaldo={cobro.modo === 'venta' && Boolean(cliente) && !cliente.consumidorFinal}
          onCobrar={cobrar} />
      )}
      {recibo && <Impresion ancho="80mm"><Recibo recibo={recibo} /></Impresion>}
    </Pantalla>,
    document.body
  );
}
