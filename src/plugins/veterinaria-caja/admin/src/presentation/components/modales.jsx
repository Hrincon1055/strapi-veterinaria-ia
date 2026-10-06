import * as React from 'react';
import {
  Modal, Button, Flex, Box, Grid, Typography, Field, TextInput, Textarea, SingleSelect, SingleSelectOption,
  Checkbox, Loader, Alert, Table, Thead, Tbody, Tr, Th, Td, Badge, Tabs, IconButton,
} from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { useBusqueda } from '../../application/useCaja';
import { dinero, fecha, fechaHora, hora, cantidad, MEDIO, TIPO_MOVIMIENTO, TRAMOS, mensajeDeError } from '../../domain/formato';
import { Opcion } from './estilos';

function Dialogo({ abierto, onCerrar, titulo, children, accion, onAccion, ocupado, peligro, deshabilitado, ancho }) {
  return (
    <Modal.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <Modal.Content style={ancho ? { maxWidth: ancho, width: '92vw' } : undefined}>
        <Modal.Header><Modal.Title>{titulo}</Modal.Title></Modal.Header>
        <Modal.Body>{children}</Modal.Body>
        <Modal.Footer>
          <Button variant="tertiary" onClick={onCerrar}>{accion ? 'Cancelar' : 'Cerrar'}</Button>
          {accion && (
            <Button variant={peligro ? 'danger' : 'default'} loading={ocupado} disabled={deshabilitado} onClick={onAccion}>{accion}</Button>
          )}
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

const TIPOS_DOCUMENTO = { cc: 'Cédula', ce: 'Cédula de extranjería', nit: 'NIT', passport: 'Pasaporte', ppt: 'PPT', ti: 'Tarjeta de identidad' };

/** Elegir el cliente del ticket, o crear la ficha de quien pide la factura a su nombre (C5). */
export function ModalCliente({ abierto, onCerrar, api, onElegir }) {
  const b = useBusqueda(React.useCallback((q) => api.buscarClientes(q), [api]), { minimo: 0 });
  const [nuevo, setNuevo] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(false);
  React.useEffect(() => { if (abierto) { b.setTexto(''); setNuevo(null); setError(null); } }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const [inicial, setInicial] = React.useState(null);
  React.useEffect(() => { if (abierto) api.buscarClientes('').then(setInicial).catch(() => setInicial([])); }, [abierto, api]);
  const lista = b.items ?? inicial ?? [];
  const cambiar = (k) => (v) => setNuevo((x) => ({ ...x, [k]: v }));

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo={nuevo ? 'Nuevo cliente' : 'Cliente de la venta'} ancho={720}
      accion={nuevo ? 'Crear y usar' : null} ocupado={ocupado}
      deshabilitado={!nuevo?.nombres?.trim() || !nuevo?.tipoDocumento || !nuevo?.documento?.trim()}
      onAccion={async () => {
        setOcupado(true);
        setError(null);
        try {
          onElegir(await api.crearCliente(nuevo));
        } catch (e) {
          setError(mensajeDeError(e, 'No se pudo crear el cliente'));
        } finally {
          setOcupado(false);
        }
      }}>
      {error && <Box paddingBottom={4}><Alert variant="danger" title="Error">{error}</Alert></Box>}
      {nuevo ? (
        <Grid.Root gap={4}>
          <Grid.Item col={12} direction="column" alignItems="stretch">
            <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => setNuevo(null)}>Buscar uno existente</Button>
          </Grid.Item>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Field.Root name="nombres" required><Field.Label>Nombres (o razón social)</Field.Label>
              <TextInput value={nuevo.nombres ?? ''} onChange={(e) => cambiar('nombres')(e.target.value)} />
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Field.Root name="apellidos"><Field.Label>Apellidos</Field.Label>
              <TextInput value={nuevo.apellidos ?? ''} onChange={(e) => cambiar('apellidos')(e.target.value)} />
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Field.Root name="tipo" required><Field.Label>Tipo de documento</Field.Label>
              <SingleSelect value={nuevo.tipoDocumento ?? ''} onChange={cambiar('tipoDocumento')}>
                {Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => <SingleSelectOption key={k} value={k}>{v}</SingleSelectOption>)}
              </SingleSelect>
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Field.Root name="documento" required><Field.Label>Número</Field.Label>
              <TextInput value={nuevo.documento ?? ''} onChange={(e) => cambiar('documento')(e.target.value)} />
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Field.Root name="telefono" hint="Formato internacional: +573001234567"><Field.Label>Teléfono</Field.Label>
              <TextInput value={nuevo.telefono ?? ''} onChange={(e) => cambiar('telefono')(e.target.value)} /><Field.Hint />
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Field.Root name="correo"><Field.Label>Correo (para la factura)</Field.Label>
              <TextInput type="email" value={nuevo.correo ?? ''} onChange={(e) => cambiar('correo')(e.target.value)} />
            </Field.Root>
          </Grid.Item>
        </Grid.Root>
      ) : (
        <Flex direction="column" gap={3} alignItems="stretch">
          <Field.Root name="buscar">
            <Field.Label>Nombre o documento</Field.Label>
            <TextInput value={b.texto} onChange={(e) => b.setTexto(e.target.value)} placeholder="María Restrepo, 1017…" />
          </Field.Root>
          {b.cargando ? <Loader small>Buscando…</Loader> : (
            <Flex direction="column" gap={1} alignItems="stretch">
              {lista.map((c) => (
                <Button key={c.documentId} variant={c.consumidorFinal ? 'secondary' : 'tertiary'} fullWidth style={{ justifyContent: 'flex-start' }}
                  onClick={() => onElegir(c)}>
                  {c.etiqueta}
                </Button>
              ))}
            </Flex>
          )}
          <Button variant="secondary" onClick={() => setNuevo({ tipoDocumento: 'cc' })}>Crear cliente nuevo</Button>
        </Flex>
      )}
    </Dialogo>
  );
}

/** Lo pendiente de cobro del cliente (consultas y hospitalizaciones): se añaden al ticket. */
export function ModalPendientes({ abierto, onCerrar, api, pendientes, onAgregar }) {
  const [abierta, setAbierta] = React.useState(null);
  const [elegidas, setElegidas] = React.useState([]);
  const [error, setError] = React.useState(null);
  React.useEffect(() => { if (abierto) { setAbierta(null); setElegidas([]); setError(null); } }, [abierto]);

  const abrir = async (p) => {
    setError(null);
    try {
      const tipo = p.origen === 'hospitalizacion' ? 'hospitalizacion' : 'consulta';
      const id = tipo === 'hospitalizacion' ? p.hospitalizacion.documentId : p.consulta.documentId;
      const estado = await api.origen(tipo, id);
      const lineas = estado.lineas.filter((l) => l.estado === 'pendiente' && !l.estimado?.problema);
      setAbierta({ tipo, id, estado, lineas });
      setElegidas(lineas.map((l) => l.lineKey));
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo cargar'));
    }
  };
  const alternar = (k) => setElegidas((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]));

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Pendientes de cobro del cliente" ancho={760}
      accion={abierta ? `Añadir ${elegidas.length} al ticket` : null} deshabilitado={elegidas.length === 0}
      onAccion={() => {
        onAgregar(abierta.lineas.filter((l) => elegidas.includes(l.lineKey)).map((l) => ({
          [abierta.tipo]: abierta.id,
          lineKey: l.lineKey,
          nombre: l.label,
          cantidad: l.quantity,
          precio: l.estimado?.unitPrice ?? 0,
          total: l.estimado?.lineTotal ?? 0,
          origen: abierta.tipo === 'hospitalizacion' ? 'Hospitalización' : 'Consulta',
        })));
        onCerrar();
      }}>
      {error && <Box paddingBottom={4}><Alert variant="danger" title="Error">{error}</Alert></Box>}
      {!abierta && (
        <Flex direction="column" gap={2} alignItems="stretch">
          {(pendientes ?? []).length === 0 && <Typography textColor="neutral600">No tiene nada pendiente de cobro.</Typography>}
          {(pendientes ?? []).map((p) => {
            const hosp = p.origen === 'hospitalizacion';
            const fechaOrigen = hosp ? p.hospitalizacion.admittedAt : p.consulta.consultedAt;
            return (
              <Opcion key={hosp ? p.hospitalizacion.documentId : p.consulta.documentId} type="button" onClick={() => abrir(p)} style={{ textAlign: 'left' }}>
                <Typography fontWeight="bold">{hosp ? 'Hospitalización' : 'Consulta'} · {fecha(fechaOrigen)} · {p.mascota?.name ?? 'Mascota'}</Typography>
                <Typography variant="pi" textColor="neutral600" tag="p">{p.pendientes} concepto(s) · {dinero(p.valorPendiente)}</Typography>
              </Opcion>
            );
          })}
        </Flex>
      )}
      {abierta && (
        <Flex direction="column" gap={2} alignItems="stretch">
          <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => setAbierta(null)}>Otro origen</Button>
          {abierta.lineas.length === 0 && <Typography textColor="neutral600">No hay conceptos cobrables (sin precio o sin IVA en el catálogo).</Typography>}
          {abierta.lineas.map((l) => (
            <Checkbox key={l.lineKey} checked={elegidas.includes(l.lineKey)} onCheckedChange={() => alternar(l.lineKey)}>
              {l.label} · {cantidad(l.quantity)} · {dinero(l.estimado?.lineTotal)}
            </Checkbox>
          ))}
        </Flex>
      )}
    </Dialogo>
  );
}

/** Cartera: clientes con saldo y sus facturas; elegir una para abonar. */
export function ModalCartera({ abierto, onCerrar, api, cliente, onAbonar }) {
  const [datos, setDatos] = React.useState(null);
  const [q, setQ] = React.useState('');
  React.useEffect(() => {
    if (!abierto) return undefined;
    let vivo = true;
    setDatos(null);
    const t = setTimeout(() => {
      (cliente ? api.cliente(cliente).then((c) => ({ clientes: [{ documentId: c.documentId, nombre: c.nombre, documento: c.documento, saldo: c.saldoEnCartera, facturas: c.cartera }], tramos: null, total: c.saldoEnCartera }))
        : api.cartera(q))
        .then((d) => vivo && setDatos(d))
        .catch(() => vivo && setDatos({ clientes: [], total: 0 }));
    }, 200);
    return () => { vivo = false; clearTimeout(t); };
  }, [abierto, api, cliente, q]);

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo={cliente ? 'Facturas por pagar del cliente' : 'Cartera'} ancho={900}>
      <Flex direction="column" gap={4} alignItems="stretch">
        {!cliente && (
          <Field.Root name="q"><Field.Label>Buscar</Field.Label>
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número de factura o cliente" />
          </Field.Root>
        )}
        {!datos && <Loader small>Cargando…</Loader>}
        {datos?.tramos && (
          <Flex gap={4} wrap="wrap">
            <Box><Typography variant="sigma" textColor="neutral600">Total</Typography><Typography variant="beta" tag="p">{dinero(datos.total)}</Typography></Box>
            {TRAMOS.map((t) => (
              <Box key={t}><Typography variant="sigma" textColor="neutral600">{t} días</Typography><Typography variant="delta" tag="p" textColor={t === '90+' && datos.tramos[t] > 0 ? 'danger600' : undefined}>{dinero(datos.tramos[t])}</Typography></Box>
            ))}
          </Flex>
        )}
        {datos?.clientes?.length === 0 && <Typography textColor="neutral600">Sin saldos pendientes.</Typography>}
        {(datos?.clientes ?? []).map((c) => (
          <Box key={c.documentId ?? 'x'} background="neutral100" hasRadius padding={3}>
            <Flex justifyContent="space-between">
              <Typography fontWeight="bold">{c.nombre}{c.documento ? ` · ${c.documento}` : ''}</Typography>
              <Typography fontWeight="bold">{dinero(c.saldo)}</Typography>
            </Flex>
            <Table colCount={5} rowCount={c.facturas.length + 1}>
              <Thead><Tr>{['Factura', 'Emitida', 'Vence', 'Saldo', ''].map((h) => <Th key={h}><Typography variant="sigma">{h}</Typography></Th>)}</Tr></Thead>
              <Tbody>
                {c.facturas.map((f) => (
                  <Tr key={f.documentId}>
                    <Td><Typography>{f.numero}</Typography></Td>
                    <Td><Typography>{fecha(f.emitida)}</Typography></Td>
                    <Td><Typography>{f.vence ? fecha(f.vence) : '—'}</Typography> {f.tramo !== '0-30' && <Badge backgroundColor="danger100" textColor="danger700">{f.tramo} días</Badge>}</Td>
                    <Td><Typography fontWeight="bold">{dinero(f.saldo)}</Typography></Td>
                    <Td><Button size="S" onClick={() => onAbonar({ ...f, cliente: c })}>Abonar</Button></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        ))}
      </Flex>
    </Dialogo>
  );
}

/** Ingreso, retiro o gasto del turno (C7); el gasto con su soporte. */
export function ModalMovimiento({ abierto, onCerrar, api, onRegistrar, ocupado }) {
  const [f, setF] = React.useState({});
  const [archivo, setArchivo] = React.useState(null);
  React.useEffect(() => { if (abierto) { setF({ tipo: 'withdrawal' }); setArchivo(null); } }, [abierto]);
  const cambiar = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const valido = Number(f.valor) > 0 && (f.tipo !== 'expense' || f.concepto?.trim());
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Movimiento de efectivo" accion="Registrar" ocupado={ocupado} deshabilitado={!valido}
      onAccion={async () => {
        const soporte = archivo ? await api.subirSoporte(archivo).catch(() => null) : null;
        onRegistrar({ tipo: f.tipo, valor: Number(f.valor), concepto: f.concepto, referencia: f.referencia, soporte });
      }}>
      <Flex direction="column" gap={4} alignItems="stretch">
        <Flex gap={2} wrap="wrap">
          {Object.entries(TIPO_MOVIMIENTO).map(([k, v]) => (
            <Opcion key={k} type="button" $activa={f.tipo === k} onClick={() => cambiar('tipo')(k)} style={{ flex: 1, minWidth: 140 }}>{v}</Opcion>
          ))}
        </Flex>
        <Typography variant="pi" textColor="neutral600">
          {f.tipo === 'cash_in' ? 'Efectivo que entra a la caja sin ser una venta (sencillo para cambio).'
            : f.tipo === 'withdrawal' ? 'Efectivo que sale hacia la caja fuerte o el banco.'
              : 'Pago menor hecho con el efectivo de la caja: domicilio, papelería…'}
        </Typography>
        <Field.Root name="valor" required><Field.Label>Valor</Field.Label>
          <TextInput type="number" min={1} value={f.valor ?? ''} onChange={(e) => cambiar('valor')(e.target.value)} />
        </Field.Root>
        <Field.Root name="concepto" required={f.tipo === 'expense'}><Field.Label>Concepto</Field.Label>
          <TextInput value={f.concepto ?? ''} onChange={(e) => cambiar('concepto')(e.target.value)} />
        </Field.Root>
        <Field.Root name="referencia"><Field.Label>Referencia (recibo, consignación…)</Field.Label>
          <TextInput value={f.referencia ?? ''} onChange={(e) => cambiar('referencia')(e.target.value)} />
        </Field.Root>
        {f.tipo === 'expense' && (
          <Field.Root name="soporte" hint="Foto o PDF del recibo."><Field.Label>Soporte</Field.Label>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
            <Field.Hint />
          </Field.Root>
        )}
      </Flex>
    </Dialogo>
  );
}

/** Devolución de una factura (C10): se busca por número; en efectivo sale de la caja o pasa a saldo a favor. */
export function ModalDevolucion({ abierto, onCerrar, api, onDevolver, ocupado }) {
  const [numero, setNumero] = React.useState('');
  const [factura, setFactura] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [f, setF] = React.useState({});
  React.useEffect(() => { if (abierto) { setNumero(''); setFactura(null); setError(null); setF({ medio: 'cash' }); } }, [abierto]);
  const buscar = async () => {
    setError(null);
    try {
      const r = await api.buscarFactura(numero.trim());
      setFactura(r);
      setF((x) => ({ ...x, valor: String(r?.factura?.pagado ?? 0) }));
    } catch (e) {
      setError(e?.response?.status === 404 ? 'No hay una factura con ese número' : mensajeDeError(e));
    }
  };
  const pagado = factura?.factura?.pagado ?? 0;
  const valido = factura && Number(f.valor) > 0 && Number(f.valor) <= pagado && f.motivo?.trim();
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Devolución" accion="Devolver" peligro ocupado={ocupado} deshabilitado={!valido} ancho={720}
      onAccion={() => onDevolver({ factura: factura.factura.documentId, valor: Number(f.valor), medio: f.medio, motivo: f.motivo })}>
      <Flex direction="column" gap={4} alignItems="stretch">
        <Flex gap={2} alignItems="flex-end">
          <Field.Root name="numero"><Field.Label>Número de factura</Field.Label>
            <TextInput value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="FE134" onKeyDown={(e) => e.key === 'Enter' && buscar()} />
          </Field.Root>
          <Button variant="secondary" onClick={buscar} disabled={!numero.trim()}>Buscar</Button>
        </Flex>
        {error && <Alert variant="danger" title="Error">{error}</Alert>}
        {factura && (
          <>
            <Box background="neutral100" hasRadius padding={3}>
              <Typography fontWeight="bold" tag="p">{factura.factura.numero} · {factura.cliente}</Typography>
              <Typography variant="pi" tag="p">Total {dinero(factura.factura.total)} · cobrado {dinero(pagado)}</Typography>
              {factura.pagos.map((p) => <Typography key={p.documentId} variant="pi" tag="p">{fechaHora(p.fecha)} · {MEDIO[p.medio]} · {dinero(p.valor)}</Typography>)}
            </Box>
            {pagado === 0 ? <Alert variant="default" title="Nada que devolver">La factura no tiene dinero cobrado.</Alert> : (
              <>
                <Flex gap={2} wrap="wrap">
                  {['cash', 'card', 'transfer', 'credit_balance'].map((m) => (
                    <Opcion key={m} type="button" $activa={f.medio === m} onClick={() => setF((x) => ({ ...x, medio: m }))} style={{ flex: 1, minWidth: 120 }}>
                      {m === 'credit_balance' ? 'A saldo a favor' : MEDIO[m]}
                    </Opcion>
                  ))}
                </Flex>
                <Field.Root name="valor" required><Field.Label>Valor a devolver</Field.Label>
                  <TextInput type="number" min={1} max={pagado} value={f.valor ?? ''} onChange={(e) => setF((x) => ({ ...x, valor: e.target.value }))} />
                </Field.Root>
                <Field.Root name="motivo" required><Field.Label>Motivo</Field.Label>
                  <Textarea value={f.motivo ?? ''} onChange={(e) => setF((x) => ({ ...x, motivo: e.target.value }))} />
                </Field.Root>
                <Typography variant="pi" textColor="neutral600">Después de devolver todo lo cobrado, la factura se puede anular desde Facturación.</Typography>
              </>
            )}
          </>
        )}
      </Flex>
    </Dialogo>
  );
}

/** El turno en curso: totales, pagos (con reverso) y movimientos. */
export function ModalTurno({ abierto, onCerrar, turno, onReversar, ocupado }) {
  const [reverso, setReverso] = React.useState(null);
  const [motivo, setMotivo] = React.useState('');
  if (!turno) return null;
  const t = turno.totales ?? {};
  return (
    <Dialogo abierto={abierto} onCerrar={() => { setReverso(null); onCerrar(); }} titulo={`Turno de ${turno.caja?.nombre ?? 'caja'}`} ancho={960}>
      <Tabs.Root defaultValue="resumen">
        <Tabs.List aria-label="Turno">
          <Tabs.Trigger value="resumen">Resumen</Tabs.Trigger>
          <Tabs.Trigger value="pagos">Pagos ({turno.pagos.length})</Tabs.Trigger>
          <Tabs.Trigger value="movimientos">Movimientos ({turno.movimientos.length})</Tabs.Trigger>
        </Tabs.List>
        <Box paddingTop={4}>
          <Tabs.Content value="resumen">
            <Grid.Root gap={4}>
              {[
                ['Base', turno.base], ['Efectivo', t.porMedio?.cash], ['Tarjeta', t.porMedio?.card], ['Transferencia', t.porMedio?.transfer],
                ['Saldo a favor usado', t.porMedio?.credit_balance], ['Anticipos', t.anticipos],
                ['Devoluciones en efectivo', t.devoluciones?.cash], ['Ingresos', t.movimientos?.cash_in], ['Retiros', t.movimientos?.withdrawal], ['Gastos', t.movimientos?.expense],
              ].map(([r, v]) => (
                <Grid.Item key={r} col={3} s={6} direction="column" alignItems="flex-start">
                  <Typography variant="sigma" textColor="neutral600">{r}</Typography>
                  <Typography variant="delta" tag="p">{dinero(v)}</Typography>
                </Grid.Item>
              ))}
              <Grid.Item col={12} direction="column" alignItems="flex-start">
                <Typography variant="sigma" textColor="neutral600">Efectivo que debe haber en la caja</Typography>
                <Typography variant="alpha" tag="p">{dinero(turno.esperado)}</Typography>
              </Grid.Item>
            </Grid.Root>
          </Tabs.Content>
          <Tabs.Content value="pagos">
            {reverso && (
              <Box paddingBottom={4}>
                <Alert variant="warning" title={`Reversar ${MEDIO[reverso.medio]} de ${dinero(reverso.valor)}`}>
                  <Flex gap={2} alignItems="flex-end" paddingTop={2}>
                    <Field.Root name="motivo"><Field.Label>Motivo</Field.Label>
                      <TextInput value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    </Field.Root>
                    <Button variant="danger" loading={ocupado} disabled={!motivo.trim()}
                      onClick={async () => { if (await onReversar(reverso.documentId, motivo.trim())) { setReverso(null); setMotivo(''); } }}>Reversar</Button>
                    <Button variant="tertiary" onClick={() => setReverso(null)}>Cancelar</Button>
                  </Flex>
                </Alert>
              </Box>
            )}
            <Table colCount={6} rowCount={turno.pagos.length + 1}>
              <Thead><Tr>{['Hora', 'Concepto', 'Medio', 'Valor', 'Cliente', ''].map((h) => <Th key={h}><Typography variant="sigma">{h}</Typography></Th>)}</Tr></Thead>
              <Tbody>
                {turno.pagos.map((p) => (
                  <Tr key={p.documentId}>
                    <Td><Typography>{hora(p.fecha)}</Typography></Td>
                    <Td><Typography>{p.tipo === 'refund' ? 'Devolución' : p.destino === 'advance' ? 'Anticipo' : p.factura ?? '—'}</Typography></Td>
                    <Td><Typography>{MEDIO[p.medio]}{p.referencia ? ` · ${p.referencia}` : ''}</Typography></Td>
                    <Td><Typography textColor={p.estado === 'reversed' ? 'neutral500' : undefined} style={p.estado === 'reversed' ? { textDecoration: 'line-through' } : undefined}>{dinero(p.valor)}</Typography></Td>
                    <Td><Typography>{p.cliente ?? '—'}</Typography></Td>
                    <Td>{p.estado === 'posted' && turno.estado === 'open' && <Button size="S" variant="tertiary" onClick={() => setReverso(p)}>Reversar</Button>}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Tabs.Content>
          <Tabs.Content value="movimientos">
            {turno.movimientos.length === 0 ? <Typography textColor="neutral600">Sin movimientos.</Typography> : (
              <Table colCount={4} rowCount={turno.movimientos.length + 1}>
                <Thead><Tr>{['Hora', 'Tipo', 'Concepto', 'Valor'].map((h) => <Th key={h}><Typography variant="sigma">{h}</Typography></Th>)}</Tr></Thead>
                <Tbody>
                  {turno.movimientos.map((m) => (
                    <Tr key={m.documentId}>
                      <Td><Typography>{hora(m.fecha)}</Typography></Td>
                      <Td><Typography>{TIPO_MOVIMIENTO[m.tipo]}</Typography></Td>
                      <Td><Typography>{m.concepto ?? '—'}</Typography></Td>
                      <Td><Typography>{m.tipo === 'cash_in' ? '' : '−'}{dinero(m.valor)}</Typography></Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Dialogo>
  );
}

/** Supervisión: turnos por día y caja, con sus descuadres. */
export function ModalSupervision({ abierto, onCerrar, api }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [desde, setDesde] = React.useState(hoy);
  const [turnos, setTurnos] = React.useState(null);
  React.useEffect(() => {
    if (!abierto) return;
    setTurnos(null);
    api.turnos({ desde, hasta: hoy }).then(setTurnos).catch(() => setTurnos([]));
  }, [abierto, api, desde, hoy]);
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Supervisión de cajas" ancho={1000}>
      <Flex direction="column" gap={4} alignItems="stretch">
        <Field.Root name="desde"><Field.Label>Desde</Field.Label>
          <TextInput type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field.Root>
        {!turnos ? <Loader small>Cargando…</Loader> : turnos.length === 0 ? <Typography textColor="neutral600">Sin turnos.</Typography> : (
          <Table colCount={8} rowCount={turnos.length + 1}>
            <Thead><Tr>{['Caja', 'Responsable', 'Apertura', 'Cierre', 'Base', 'Esperado', 'Contado', 'Descuadre'].map((h) => <Th key={h}><Typography variant="sigma">{h}</Typography></Th>)}</Tr></Thead>
            <Tbody>
              {turnos.map((t) => (
                <Tr key={t.documentId}>
                  <Td><Typography>{t.caja}</Typography></Td>
                  <Td><Typography>{t.responsable}</Typography></Td>
                  <Td><Typography>{fechaHora(t.apertura)}</Typography></Td>
                  <Td>{t.estado === 'open' ? <Badge backgroundColor="success100" textColor="success700">Abierto</Badge> : <Typography>{fechaHora(t.cierre)}</Typography>}</Td>
                  <Td><Typography>{dinero(t.base)}</Typography></Td>
                  <Td><Typography>{t.esperado == null ? '—' : dinero(t.esperado)}</Typography></Td>
                  <Td><Typography>{t.contado == null ? '—' : dinero(t.contado)}</Typography></Td>
                  <Td>
                    {t.descuadre == null ? '—' : (
                      <Typography textColor={t.descuadre === 0 ? 'success600' : 'danger600'} title={t.motivo ?? ''}>
                        {t.descuadre === 0 ? 'Cuadra' : dinero(t.descuadre)}
                      </Typography>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Flex>
    </Dialogo>
  );
}
