import * as React from 'react';
import {
  Modal, Button, Flex, Typography, Field, TextInput, Textarea, Box, Tabs, Checkbox, Loader, Alert,
} from '@strapi/design-system';
import { dinero, fecha, cantidad, ESTADO_CLINICO, mensajeDeError } from '../../domain/formato';

/** Esqueleto común: título, cuerpo y pie con Cancelar + acción principal. */
function Dialogo({ abierto, onCerrar, titulo, children, accion, onAccion, ocupado, peligro, deshabilitado }) {
  return (
    <Modal.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{titulo}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{children}</Modal.Body>
        <Modal.Footer>
          <Button variant="tertiary" onClick={onCerrar}>Cancelar</Button>
          <Button variant={peligro ? 'danger' : 'default'} loading={ocupado} disabled={deshabilitado} onClick={onAccion}>
            {accion}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

/**
 * Emitir: es irreversible (consume un número de la resolución DIAN), así que
 * se confirma y se dice qué va a pasar.
 */
export function ModalEmitir({ abierto, onCerrar, onEmitir, factura, ocupado }) {
  const [vence, setVence] = React.useState('');
  return (
    <Dialogo
      abierto={abierto} onCerrar={onCerrar} titulo="Emitir factura" accion="Emitir" ocupado={ocupado}
      onAccion={async () => { if (await onEmitir(vence || undefined)) onCerrar(); }}
    >
      <Flex direction="column" gap={4} alignItems="stretch">
        <Typography>
          Se le asignará el siguiente número de la resolución DIAN activa y quedarán congelados los
          datos del cliente y de la clínica. Una factura emitida no se edita ni se borra: se anula.
        </Typography>
        <Typography fontWeight="bold">Total: {dinero(factura?.total, factura?.moneda)}</Typography>
        <Field.Root name="vence" hint="Déjalo vacío si es de contado.">
          <Field.Label>Vencimiento (opcional)</Field.Label>
          <TextInput type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
          <Field.Hint />
        </Field.Root>
      </Flex>
    </Dialogo>
  );
}

export function ModalAnular({ abierto, onCerrar, onAnular, factura, ocupado }) {
  const [motivo, setMotivo] = React.useState('');
  return (
    <Dialogo
      abierto={abierto} onCerrar={onCerrar} titulo={`Anular la factura ${factura?.numero ?? ''}`} accion="Anular"
      peligro ocupado={ocupado} deshabilitado={!motivo.trim()}
      onAccion={async () => { if (await onAnular(motivo.trim())) onCerrar(); }}
    >
      <Flex direction="column" gap={4} alignItems="stretch">
        <Typography>
          La factura queda anulada (se conserva, con su número) y sus conceptos vuelven a quedar
          pendientes de cobro, para facturarlos de nuevo si hace falta.
        </Typography>
        <Field.Root name="motivo" required>
          <Field.Label>Motivo</Field.Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: error en el documento del cliente" />
        </Field.Root>
      </Flex>
    </Dialogo>
  );
}

export function ModalBorrar({ abierto, onCerrar, onBorrar }) {
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Eliminar borrador" accion="Eliminar" peligro
      onAccion={async () => { if (await onBorrar()) onCerrar(); }}>
      <Typography>El borrador y sus renglones se eliminan; los conceptos vuelven a quedar pendientes.</Typography>
    </Dialogo>
  );
}

/** Lista de resultados de búsqueda como botones (más fiable que un combobox asíncrono). */
function Resultados({ items, render, onElegir, vacio }) {
  if (!items) return null;
  if (items.length === 0) return <Typography variant="pi" textColor="neutral600">{vacio}</Typography>;
  return (
    <Flex direction="column" gap={1} alignItems="stretch">
      {items.map((it) => (
        <Button key={it.documentId} variant="tertiary" fullWidth onClick={() => onElegir(it)} style={{ justifyContent: 'flex-start' }}>
          {render(it)}
        </Button>
      ))}
    </Flex>
  );
}

function useBusqueda(buscar) {
  const [texto, setTexto] = React.useState('');
  const [items, setItems] = React.useState(null);
  const [cargando, setCargando] = React.useState(false);
  React.useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      setCargando(true);
      try {
        const r = await buscar(texto);
        if (vivo) setItems(r);
      } finally {
        if (vivo) setCargando(false);
      }
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [texto, buscar]);
  return { texto, setTexto, items, cargando };
}

/** Venta sin consulta (mostrador): elegir cliente y abrir un borrador vacío. */
export function ModalVentaDirecta({ abierto, onCerrar, buscarClientes, onCrear }) {
  const b = useBusqueda(buscarClientes);
  return (
    <Modal.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <Modal.Content>
        <Modal.Header><Modal.Title>Nueva venta directa</Modal.Title></Modal.Header>
        <Modal.Body>
          <Flex direction="column" gap={4} alignItems="stretch">
            <Typography variant="pi" textColor="neutral600">
              Para vender sin consulta (alimento, accesorios…). Elige el cliente; los productos y
              servicios se añaden en el borrador.
            </Typography>
            <Field.Root name="cliente">
              <Field.Label>Buscar cliente por nombre o documento</Field.Label>
              <TextInput value={b.texto} onChange={(e) => b.setTexto(e.target.value)} placeholder="Ana Ruiz, 1020…" />
            </Field.Root>
            {b.cargando ? <Loader small>Buscando…</Loader> : (
              <Resultados items={b.items} vacio="Ningún cliente coincide." onElegir={(c) => onCrear(c.documentId)}
                render={(c) => c.etiqueta} />
            )}
          </Flex>
        </Modal.Body>
        <Modal.Footer><Button variant="tertiary" onClick={onCerrar}>Cancelar</Button></Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

/**
 * Añadir conceptos a un borrador: del catálogo (venta directa) o de otras
 * consultas pendientes del mismo cliente (una factura puede cubrir varias).
 */
export function ModalAgregar({ abierto, onCerrar, factura, busquedas, onAgregarDirecto, onAgregarConceptos }) {
  const catalogo = useBusqueda(busquedas.buscarCatalogo);
  const [consultas, setConsultas] = React.useState(null);
  const [abierta, setAbierta] = React.useState(null); // estado de la consulta elegida
  const [elegidas, setElegidas] = React.useState([]);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!abierto || !factura?.cliente?.documentId) return;
    setAbierta(null); setElegidas([]); setError(null);
    busquedas.pendientesDelCliente(factura.cliente.documentId).then(setConsultas).catch((e) => setError(mensajeDeError(e)));
  }, [abierto, factura?.cliente?.documentId, busquedas]);

  const abrirConsulta = async (id) => {
    setElegidas([]);
    try { setAbierta(await busquedas.estadoConsulta(id)); } catch (e) { setError(mensajeDeError(e)); }
  };
  const alternar = (k) => setElegidas((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]));

  return (
    <Modal.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <Modal.Content>
        <Modal.Header><Modal.Title>Añadir conceptos</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Box paddingBottom={4}><Alert variant="danger" title="Error">{error}</Alert></Box>}
          <Tabs.Root defaultValue="catalogo">
            <Tabs.List aria-label="Origen del concepto">
              <Tabs.Trigger value="catalogo">Del catálogo</Tabs.Trigger>
              <Tabs.Trigger value="consultas">De otras consultas del cliente</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="catalogo">
              <Flex direction="column" gap={3} alignItems="stretch" paddingTop={4}>
                <Field.Root name="catalogo">
                  <Field.Label>Buscar servicio o producto</Field.Label>
                  <TextInput value={catalogo.texto} onChange={(e) => catalogo.setTexto(e.target.value)} placeholder="Consulta, Meloxicam, collar…" />
                </Field.Root>
                {catalogo.cargando ? <Loader small>Buscando…</Loader> : (
                  <Flex direction="column" gap={1} alignItems="stretch">
                    {(catalogo.items ?? []).map((it) => (
                      <Flex key={`${it.relacion}-${it.documentId}`} justifyContent="space-between" gap={2}>
                        <Box>
                          <Typography>{it.nombre}</Typography>
                          <Typography variant="pi" textColor={it.problema ? 'danger600' : 'neutral600'}>
                            {' '}· {it.relacion === 'service' ? 'Servicio' : 'Producto'}
                            {it.precio != null ? ` · ${dinero(it.precio)}` : ''}
                            {it.problema ? ` · ${it.problema}` : ''}
                          </Typography>
                        </Box>
                        <Button size="S" variant="secondary" disabled={Boolean(it.problema)}
                          onClick={async () => { if (await onAgregarDirecto({ relacion: it.relacion, documentId: it.documentId, quantity: 1 })) onCerrar(); }}>
                          Añadir
                        </Button>
                      </Flex>
                    ))}
                  </Flex>
                )}
              </Flex>
            </Tabs.Content>

            <Tabs.Content value="consultas">
              <Flex direction="column" gap={3} alignItems="stretch" paddingTop={4}>
                {consultas === null && <Loader small>Cargando…</Loader>}
                {consultas?.length === 0 && (
                  <Typography variant="pi" textColor="neutral600">Este cliente no tiene otras consultas con conceptos pendientes.</Typography>
                )}
                {!abierta && consultas?.map((c) => (
                  <Button key={c.consulta.documentId} variant="tertiary" fullWidth onClick={() => abrirConsulta(c.consulta.documentId)}>
                    {fecha(c.consulta.consultedAt)} · {c.mascota?.name ?? 'Mascota'} · {c.pendientes} pendiente(s) · {dinero(c.valorPendiente)}
                  </Button>
                ))}
                {abierta && (
                  <>
                    <Typography fontWeight="bold">{fecha(abierta.consulta.consultedAt)} · {abierta.mascota?.name}</Typography>
                    {abierta.lineas.filter((l) => l.estado === 'pendiente').map((l) => (
                      <Checkbox key={l.lineKey} checked={elegidas.includes(l.lineKey)} onCheckedChange={() => alternar(l.lineKey)}>
                        {l.label} · {cantidad(l.quantity)} · {ESTADO_CLINICO[l.state] ?? l.state}
                        {l.estimado?.problema ? ` · ${l.estimado.problema}` : l.estimado?.lineTotal != null ? ` · ${dinero(l.estimado.lineTotal)}` : ''}
                      </Checkbox>
                    ))}
                    <Flex gap={2}>
                      <Button variant="tertiary" onClick={() => setAbierta(null)}>Otra consulta</Button>
                      <Button disabled={elegidas.length === 0}
                        onClick={async () => {
                          const ok = await onAgregarConceptos(elegidas.map((k) => ({ consulta: abierta.consulta.documentId, lineKey: k })));
                          if (ok) onCerrar();
                        }}>
                        Añadir {elegidas.length || ''} concepto(s)
                      </Button>
                    </Flex>
                  </>
                )}
              </Flex>
            </Tabs.Content>
          </Tabs.Root>
        </Modal.Body>
        <Modal.Footer><Button variant="tertiary" onClick={onCerrar}>Cerrar</Button></Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
