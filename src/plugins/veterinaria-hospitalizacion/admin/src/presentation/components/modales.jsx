import * as React from 'react';
import {
  Modal, Button, Flex, Box, Grid, Typography, Field, TextInput, Textarea, SingleSelect, SingleSelectOption,
  Checkbox, Loader, Alert, Radio, IconButton, Divider,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import { useBusqueda } from '../../application/useHospitalizacion';
import {
  VIA, TIPO_ALTA, MUCOSAS, HIDRATACION, ESTADO_MENTAL, APETITO, TAMANO, UNIDAD, horaActual, numero, mensajeDeError,
} from '../../domain/formato';

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

/** Lista de resultados de búsqueda como botones (más fiable que un combobox asíncrono). */
function Resultados({ items, render, onElegir, vacio, elegido }) {
  if (!items) return null;
  if (items.length === 0) return <Typography variant="pi" textColor="neutral600">{vacio}</Typography>;
  return (
    <Flex direction="column" gap={1} alignItems="stretch">
      {items.map((it) => (
        <Button
          key={it.documentId}
          variant={elegido === it.documentId ? 'secondary' : 'tertiary'}
          fullWidth
          onClick={() => onElegir(it)}
          style={{ justifyContent: 'flex-start' }}
        >
          {render(it)}
        </Button>
      ))}
    </Flex>
  );
}

function Selector({ etiqueta, valor, onCambio, opciones, requerido, placeholder, hint }) {
  return (
    <Field.Root name={etiqueta} required={requerido} hint={hint}>
      <Field.Label>{etiqueta}</Field.Label>
      <SingleSelect value={valor ?? ''} onChange={onCambio} placeholder={placeholder ?? 'Elige…'}>
        {Object.entries(opciones).map(([k, v]) => <SingleSelectOption key={k} value={k}>{v}</SingleSelectOption>)}
      </SingleSelect>
      {hint && <Field.Hint />}
    </Field.Root>
  );
}

function Campo({ etiqueta, valor, onCambio, tipo = 'text', requerido, hint, placeholder, ...resto }) {
  return (
    <Field.Root name={etiqueta} required={requerido} hint={hint}>
      <Field.Label>{etiqueta}</Field.Label>
      <TextInput type={tipo} value={valor ?? ''} onChange={(e) => onCambio(e.target.value)} placeholder={placeholder} {...resto} />
      {hint && <Field.Hint />}
    </Field.Root>
  );
}

function Texto({ etiqueta, valor, onCambio, requerido, hint, placeholder }) {
  return (
    <Field.Root name={etiqueta} required={requerido} hint={hint}>
      <Field.Label>{etiqueta}</Field.Label>
      <Textarea value={valor ?? ''} onChange={(e) => onCambio(e.target.value)} placeholder={placeholder} />
      {hint && <Field.Hint />}
    </Field.Root>
  );
}

/** Carga una lista al abrir el modal. */
function useAlAbrir(abierto, cargar) {
  const [lista, setLista] = React.useState(null);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    if (!abierto) return;
    setLista(null);
    setError(null);
    cargar().then(setLista).catch((e) => setError(mensajeDeError(e, 'No se pudo cargar')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);
  return { lista, error };
}

// ---- ingreso ------------------------------------------------------------------

export function ModalIngreso({ abierto, onCerrar, busquedas, onIngresar, ocupado, jaulaInicial }) {
  const mascotas = useBusqueda(busquedas.mascotas);
  const jaulas = useAlAbrir(abierto, busquedas.jaulasLibres);
  const vets = useAlAbrir(abierto, busquedas.veterinarios);
  const [mascota, setMascota] = React.useState(null);
  const [jaula, setJaula] = React.useState('');
  const [vet, setVet] = React.useState('');
  const [motivo, setMotivo] = React.useState('');
  const [notas, setNotas] = React.useState('');

  React.useEffect(() => {
    if (!abierto) return;
    setMascota(null); setJaula(jaulaInicial ?? ''); setVet(''); setMotivo(''); setNotas(''); mascotas.setTexto('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, jaulaInicial]);

  const valido = mascota && !mascota.hospitalizada && jaula && vet && motivo.trim();
  return (
    <Dialogo
      abierto={abierto} onCerrar={onCerrar} titulo="Ingresar paciente" accion="Ingresar" ocupado={ocupado} deshabilitado={!valido}
      onAccion={() => onIngresar({ mascota: mascota.documentId, jaula, veterinario: vet, motivo: motivo.trim(), notas })}
    >
      <Flex direction="column" gap={4} alignItems="stretch">
        <Field.Root name="mascota" required>
          <Field.Label>Mascota (nombre, propietario o documento)</Field.Label>
          <TextInput value={mascotas.texto} onChange={(e) => { mascotas.setTexto(e.target.value); setMascota(null); }} placeholder="Kira, Gómez, 1020…" />
        </Field.Root>
        {mascota ? (
          <Flex justifyContent="space-between" gap={2}>
            <Typography fontWeight="bold">{mascota.etiqueta}</Typography>
            <Button variant="tertiary" size="S" onClick={() => setMascota(null)}>Cambiar</Button>
          </Flex>
        ) : mascotas.cargando ? <Loader small>Buscando…</Loader> : (
          <Resultados
            items={mascotas.items}
            vacio="Ninguna mascota coincide."
            onElegir={setMascota}
            render={(m) => (m.hospitalizada ? `${m.etiqueta} — ya ingresada (${m.hospitalizada.jaula ?? 'sin jaula'})` : m.etiqueta)}
          />
        )}
        {mascota?.hospitalizada && <Alert variant="warning" title="Ya está ingresada">Esta mascota ya tiene una hospitalización activa.</Alert>}

        {(jaulas.error || vets.error) && <Alert variant="danger" title="Error">{jaulas.error ?? vets.error}</Alert>}
        <Grid.Root gap={4}>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            {jaulas.lista === null ? <Loader small>Cargando jaulas…</Loader> : jaulas.lista.length === 0 ? (
              <Alert variant="warning" title="Sin jaulas libres">No hay ninguna jaula activa libre.</Alert>
            ) : (
              <Selector
                etiqueta="Jaula" requerido valor={jaula} onCambio={setJaula}
                opciones={Object.fromEntries(jaulas.lista.map((j) => [j.documentId, `${j.nombre}${j.sala ? ` · ${j.sala}` : ''} · ${TAMANO[j.tamano] ?? j.tamano}`]))}
              />
            )}
          </Grid.Item>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            {vets.lista === null ? <Loader small>Cargando…</Loader> : (
              <Selector
                etiqueta="Veterinario responsable" requerido valor={vet} onCambio={setVet}
                opciones={Object.fromEntries(vets.lista.map((v) => [v.documentId, v.nombre]))}
              />
            )}
          </Grid.Item>
        </Grid.Root>
        <Texto etiqueta="Motivo del ingreso" requerido valor={motivo} onCambio={setMotivo} placeholder="Ej.: gastroenteritis hemorrágica, fluidoterapia" />
        <Texto etiqueta="Notas de ingreso" valor={notas} onCambio={setNotas} placeholder="Estado al ingreso, pertenencias, indicaciones del propietario…" />
      </Flex>
    </Dialogo>
  );
}

// ---- orden de tratamiento -----------------------------------------------------

export function ModalOrden({ abierto, onCerrar, busquedas, onPrescribir, ocupado }) {
  const productos = useBusqueda(busquedas.productos);
  const [producto, setProducto] = React.useState(null);
  const [f, setF] = React.useState({});
  const cambiar = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  React.useEffect(() => {
    if (!abierto) return;
    setProducto(null); productos.setTexto('');
    setF({ dosis: '', cantidadPorToma: '1', via: 'oral', cadaHoras: '8', siEsNecesario: false, desde: '', notas: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const valido = producto && Number(f.cantidadPorToma) > 0 && (f.siEsNecesario || Number(f.cadaHoras) >= 1);
  return (
    <Dialogo
      abierto={abierto} onCerrar={onCerrar} titulo="Nueva orden de tratamiento" accion="Prescribir" ocupado={ocupado} deshabilitado={!valido}
      onAccion={() => onPrescribir({
        producto: producto.documentId,
        dosis: f.dosis,
        cantidadPorToma: f.cantidadPorToma,
        via: f.via,
        cadaHoras: f.siEsNecesario ? null : f.cadaHoras,
        siEsNecesario: f.siEsNecesario,
        // datetime-local va en la hora del navegador: se pasa a instante.
        desde: f.desde ? new Date(f.desde).toISOString() : undefined,
        notas: f.notas,
      })}
    >
      <Flex direction="column" gap={4} alignItems="stretch">
        <Field.Root name="producto" required hint="Medicamentos, vacunas e insumos activos del catálogo. Lo que se administre se factura con su precio.">
          <Field.Label>Producto</Field.Label>
          <TextInput value={producto ? producto.nombre : productos.texto} onChange={(e) => { setProducto(null); productos.setTexto(e.target.value); }} placeholder="Meloxicam, Ringer lactato…" />
          <Field.Hint />
        </Field.Root>
        {!producto && (productos.cargando ? <Loader small>Buscando…</Loader> : (
          <Resultados items={productos.items} vacio="Ningún producto prescribible coincide." onElegir={setProducto}
            render={(p) => `${p.nombre} · ${UNIDAD[p.unidad] ?? p.unidad}`} />
        ))}
        <Grid.Root gap={4}>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Campo etiqueta="Dosis clínica" valor={f.dosis} onCambio={cambiar('dosis')} placeholder="0,1 mg/kg" />
          </Grid.Item>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Campo etiqueta={`Cantidad por toma (${UNIDAD[producto?.unidad] ?? 'unidades de venta'})`} tipo="number" min={0.01} step="0.01"
              valor={f.cantidadPorToma} onCambio={cambiar('cantidadPorToma')} requerido hint="Es lo que se cobra en cada toma." />
          </Grid.Item>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Selector etiqueta="Vía" valor={f.via} onCambio={cambiar('via')} opciones={VIA} requerido />
          </Grid.Item>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Campo etiqueta="Cada (horas)" tipo="number" min={1} max={168} valor={f.siEsNecesario ? '' : f.cadaHoras}
              onCambio={cambiar('cadaHoras')} disabled={f.siEsNecesario} requerido={!f.siEsNecesario} />
          </Grid.Item>
        </Grid.Root>
        <Checkbox checked={f.siEsNecesario} onCheckedChange={(v) => cambiar('siEsNecesario')(Boolean(v))}>
          Si es necesario (sin horario: se registra cuando se da)
        </Checkbox>
        <Campo etiqueta="Primera toma" tipo="datetime-local" valor={f.desde} onCambio={cambiar('desde')} hint="Vacío: ahora. Las siguientes se programan cada tantas horas desde aquí." />
        <Texto etiqueta="Notas" valor={f.notas} onCambio={cambiar('notas')} placeholder="Diluir en 10 ml de SSN, pasar en 15 min…" />
      </Flex>
    </Dialogo>
  );
}

export function ModalSuspender({ orden, onCerrar, onSuspender, ocupado }) {
  const [motivo, setMotivo] = React.useState('');
  React.useEffect(() => setMotivo(''), [orden]);
  return (
    <Dialogo
      abierto={Boolean(orden)} onCerrar={onCerrar} titulo="Suspender orden" accion="Suspender" peligro ocupado={ocupado}
      onAccion={() => onSuspender(orden.documentId, motivo)}
    >
      <Flex direction="column" gap={4} alignItems="stretch">
        <Typography>
          <b>{orden?.producto?.nombre}</b> deja de programar tomas desde ahora. Las ya registradas se conservan.
          Para cambiar la dosis o la frecuencia, suspéndela y prescribe otra.
        </Typography>
        <Texto etiqueta="Motivo" valor={motivo} onCambio={setMotivo} placeholder="Ej.: cambio a vía oral" />
      </Flex>
    </Dialogo>
  );
}

// ---- enfermería --------------------------------------------------------------

export function ModalSignos({ abierto, onCerrar, onRegistrar, ocupado, esHoy }) {
  const [f, setF] = React.useState({});
  const cambiar = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  React.useEffect(() => { if (abierto) setF({ hora: esHoy ? '' : '08:00' }); }, [abierto, esHoy]);
  const booleano = (k, rotulo) => (
    <Selector etiqueta={rotulo} valor={f[k] === undefined ? 'nd' : f[k] ? 'si' : 'no'} onCambio={(v) => cambiar(k)(v === 'nd' ? undefined : v === 'si')}
      opciones={{ nd: 'Sin dato', si: 'Sí', no: 'No' }} />
  );
  const algo = ['temperatura', 'fc', 'fr', 'dolor', 'mucosas', 'tllc', 'hidratacion', 'estadoMental', 'apetito', 'pesoKg', 'notas', 'orino', 'defeco', 'vomito']
    .some((k) => f[k] !== undefined && f[k] !== '');
  return (
    <Dialogo
      abierto={abierto} onCerrar={onCerrar} titulo="Registrar signos y evolución" accion="Registrar" ocupado={ocupado} deshabilitado={!algo}
      onAccion={() => onRegistrar({ ...f, hora: f.hora || undefined })}
    >
      <Flex direction="column" gap={4} alignItems="stretch">
        <Grid.Root gap={4}>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
            <Campo etiqueta="Hora" tipo="time" valor={f.hora} onCambio={cambiar('hora')} hint={esHoy ? 'Vacío: ahora' : 'Del día de la hoja'} />
          </Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
            <Campo etiqueta="Temperatura (°C)" tipo="number" step="0.1" min={30} max={45} valor={f.temperatura} onCambio={cambiar('temperatura')} />
          </Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
            <Campo etiqueta="Frec. cardíaca (lpm)" tipo="number" min={0} max={400} valor={f.fc} onCambio={cambiar('fc')} />
          </Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
            <Campo etiqueta="Frec. respiratoria (rpm)" tipo="number" min={0} max={200} valor={f.fr} onCambio={cambiar('fr')} />
          </Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
            <Campo etiqueta="Dolor (0–10)" tipo="number" min={0} max={10} valor={f.dolor} onCambio={cambiar('dolor')} />
          </Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
            <Campo etiqueta="Llenado capilar (s)" tipo="number" step="0.5" min={0} max={10} valor={f.tllc} onCambio={cambiar('tllc')} />
          </Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
            <Selector etiqueta="Mucosas" valor={f.mucosas} onCambio={cambiar('mucosas')} opciones={MUCOSAS} />
          </Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
            <Selector etiqueta="Hidratación" valor={f.hidratacion} onCambio={cambiar('hidratacion')} opciones={HIDRATACION} />
          </Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
            <Selector etiqueta="Estado mental" valor={f.estadoMental} onCambio={cambiar('estadoMental')} opciones={ESTADO_MENTAL} />
          </Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
            <Selector etiqueta="Apetito" valor={f.apetito} onCambio={cambiar('apetito')} opciones={APETITO} />
          </Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
            <Campo etiqueta="Peso (kg)" tipo="number" step="0.01" min={0} valor={f.pesoKg} onCambio={cambiar('pesoKg')} />
          </Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">{booleano('orino', 'Orinó')}</Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">{booleano('defeco', 'Defecó')}</Grid.Item>
          <Grid.Item col={4} s={6} direction="column" alignItems="stretch">{booleano('vomito', 'Vomitó')}</Grid.Item>
        </Grid.Root>
        <Texto etiqueta="Observaciones" valor={f.notas} onCambio={cambiar('notas')} placeholder="Comportamiento, heces, vía venosa, curaciones…" />
      </Flex>
    </Dialogo>
  );
}

/**
 * Registrar una toma programada: dada (con su cantidad) u omitida (con el
 * motivo). La hora real es la de ahora salvo que se indique otra.
 */
export function ModalToma({ toma, onCerrar, onRegistrar, ocupado, esHoy }) {
  const [f, setF] = React.useState({});
  const cambiar = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  React.useEffect(() => {
    if (!toma) return;
    setF({
      estado: 'given',
      cantidad: String(toma.orden.cantidadPorToma),
      // En la hoja de otro día no hay "ahora": se propone la hora programada.
      hora: esHoy ? '' : toma.toma.horaTexto,
      motivo: '',
      notas: '',
    });
  }, [toma, esHoy]);
  const omitida = f.estado === 'omitted';
  const valido = omitida ? Boolean(f.motivo?.trim()) : Number(f.cantidad) > 0;
  return (
    <Dialogo
      abierto={Boolean(toma)} onCerrar={onCerrar} titulo="Registrar toma" accion={omitida ? 'Registrar omisión' : 'Registrar toma dada'}
      ocupado={ocupado} deshabilitado={!valido}
      onAccion={() => onRegistrar({
        orden: toma.orden.documentId,
        programada: toma.toma.programada,
        estado: f.estado,
        cantidad: omitida ? undefined : f.cantidad,
        motivo: omitida ? f.motivo : undefined,
        notas: f.notas,
        hora: f.hora || undefined,
      })}
    >
      <Flex direction="column" gap={4} alignItems="stretch">
        <Box>
          <Typography fontWeight="bold">{toma?.orden.producto?.nombre}</Typography>
          <Typography variant="pi" textColor="neutral600">
            {' '}· {[toma?.orden.dosis, VIA[toma?.orden.via]].filter(Boolean).join(' · ')} · programada a las {toma?.toma.horaTexto}
          </Typography>
        </Box>
        <Radio.Group value={f.estado} onValueChange={cambiar('estado')} aria-label="Estado de la toma">
          <Radio.Item value="given">Dada</Radio.Item>
          <Radio.Item value="omitted">No se dio (omitida)</Radio.Item>
        </Radio.Group>
        <Grid.Root gap={4}>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Campo etiqueta="Hora real" tipo="time" valor={f.hora} onCambio={cambiar('hora')} hint={esHoy ? 'Vacío: ahora' : undefined} />
          </Grid.Item>
          {!omitida && (
            <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
              <Campo etiqueta={`Cantidad (${UNIDAD[toma?.orden.producto?.unidad] ?? 'und'})`} tipo="number" min={0.01} step="0.01"
                valor={f.cantidad} onCambio={cambiar('cantidad')} requerido />
            </Grid.Item>
          )}
        </Grid.Root>
        {omitida && <Texto etiqueta="Motivo" requerido valor={f.motivo} onCambio={cambiar('motivo')} placeholder="Vomitó, en ayunas para cirugía, rechazó…" />}
        <Texto etiqueta="Notas" valor={f.notas} onCambio={cambiar('notas')} />
        {!omitida && Number(f.cantidad) !== Number(toma?.orden.cantidadPorToma) && (
          <Alert variant="default" title="Cantidad distinta de la prescrita">
            La orden indica {numero(toma?.orden.cantidadPorToma, 2)} por toma; se cobrará lo que registres.
          </Alert>
        )}
      </Flex>
    </Dialogo>
  );
}

/** Una dosis sin orden (o de una orden "si es necesario"). */
export function ModalDosisUnica({ abierto, onCerrar, busquedas, ordenesPrn, onRegistrar, ocupado, esHoy }) {
  const productos = useBusqueda(busquedas.productos);
  const [producto, setProducto] = React.useState(null);
  const [orden, setOrden] = React.useState('');
  const [f, setF] = React.useState({});
  const cambiar = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  React.useEffect(() => {
    if (!abierto) return;
    setProducto(null); setOrden(''); productos.setTexto('');
    setF({ cantidad: '1', hora: esHoy ? '' : '08:00', notas: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, esHoy]);
  const valido = (orden || producto) && Number(f.cantidad) > 0;
  return (
    <Dialogo
      abierto={abierto} onCerrar={onCerrar} titulo="Registrar dosis" accion="Registrar" ocupado={ocupado} deshabilitado={!valido}
      onAccion={() => onRegistrar({ ...(orden ? { orden } : { producto: producto.documentId }), cantidad: f.cantidad, notas: f.notas, hora: f.hora || undefined })}
    >
      <Flex direction="column" gap={4} alignItems="stretch">
        {ordenesPrn.length > 0 && (
          <Selector
            etiqueta="De una orden «si es necesario»" valor={orden || 'ninguna'}
            onCambio={(v) => { setOrden(v === 'ninguna' ? '' : v); if (v !== 'ninguna') setProducto(null); }}
            opciones={{ ninguna: 'Ninguna: dosis única', ...Object.fromEntries(ordenesPrn.map((o) => [o.documentId, `${o.producto?.nombre} · ${o.dosis ?? ''}`])) }}
          />
        )}
        {!orden && (
          <>
            <Field.Root name="producto" required>
              <Field.Label>Producto</Field.Label>
              <TextInput value={producto ? producto.nombre : productos.texto} onChange={(e) => { setProducto(null); productos.setTexto(e.target.value); }} placeholder="Buscar en el catálogo…" />
            </Field.Root>
            {!producto && (productos.cargando ? <Loader small>Buscando…</Loader> : (
              <Resultados items={productos.items} vacio="Ningún producto coincide." onElegir={setProducto} render={(p) => p.nombre} />
            ))}
          </>
        )}
        <Grid.Root gap={4}>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Campo etiqueta="Hora" tipo="time" valor={f.hora} onCambio={cambiar('hora')} hint={esHoy ? 'Vacío: ahora' : undefined} />
          </Grid.Item>
          <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
            <Campo etiqueta="Cantidad (unidades de venta)" tipo="number" min={0.01} step="0.01" valor={f.cantidad} onCambio={cambiar('cantidad')} requerido />
          </Grid.Item>
        </Grid.Root>
        <Texto etiqueta="Notas" valor={f.notas} onCambio={cambiar('notas')} />
      </Flex>
    </Dialogo>
  );
}

// ---- traslado y alta ----------------------------------------------------------

export function ModalTraslado({ abierto, onCerrar, busquedas, onTrasladar, ocupado, jaulaActual }) {
  const jaulas = useAlAbrir(abierto, busquedas.jaulasLibres);
  const [jaula, setJaula] = React.useState('');
  React.useEffect(() => { if (abierto) setJaula(''); }, [abierto]);
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo="Trasladar de jaula" accion="Trasladar" ocupado={ocupado} deshabilitado={!jaula}
      onAccion={() => onTrasladar(jaula)}>
      <Flex direction="column" gap={4} alignItems="stretch">
        <Typography>Ahora en <b>{jaulaActual ?? '—'}</b>. Desde hoy, cada día se cobra con el servicio diario de la jaula que ocupe al final del día.</Typography>
        {jaulas.error && <Alert variant="danger" title="Error">{jaulas.error}</Alert>}
        {jaulas.lista === null ? <Loader small>Cargando jaulas…</Loader> : jaulas.lista.length === 0 ? (
          <Alert variant="warning" title="Sin jaulas libres">No hay otra jaula activa libre.</Alert>
        ) : (
          <Selector etiqueta="Jaula de destino" requerido valor={jaula} onCambio={setJaula}
            opciones={Object.fromEntries(jaulas.lista.map((j) => [j.documentId, `${j.nombre}${j.sala ? ` · ${j.sala}` : ''}${j.servicioDiario ? ` · ${j.servicioDiario}` : ''}`]))} />
        )}
      </Flex>
    </Dialogo>
  );
}

const MEDICACION_VACIA = { drug: '', dose: '', route: 'oral', frequencyHours: '', durationDays: '', notes: '' };

export function ModalAlta({ abierto, onCerrar, onDarAlta, ocupado, mascota }) {
  const [f, setF] = React.useState({});
  const cambiar = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  React.useEffect(() => {
    if (abierto) setF({ tipo: 'medical', resumen: '', indicaciones: '', control: '', medicacion: [] });
  }, [abierto]);
  const cambiarMed = (i, k, v) => setF((x) => ({ ...x, medicacion: x.medicacion.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));
  const valido = f.tipo && (f.tipo !== 'medical' || f.resumen?.trim());
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo={`Dar el alta a ${mascota ?? 'la mascota'}`} accion="Dar el alta" ocupado={ocupado} deshabilitado={!valido}
      onAccion={() => onDarAlta(f)}>
      <Flex direction="column" gap={4} alignItems="stretch">
        <Alert variant="default" title="El alta cierra la hospitalización">
          Libera la jaula y termina las órdenes activas. Después solo se pueden corregir el resumen, las indicaciones,
          la medicación de alta y el control.
        </Alert>
        <Selector etiqueta="Tipo de alta" requerido valor={f.tipo} onCambio={cambiar('tipo')} opciones={TIPO_ALTA} />
        <Texto etiqueta="Resumen de la hospitalización" requerido={f.tipo === 'medical'} valor={f.resumen} onCambio={cambiar('resumen')}
          placeholder="Evolución, tratamiento recibido, estado al alta…" />
        <Texto etiqueta="Indicaciones para casa" valor={f.indicaciones} onCambio={cambiar('indicaciones')}
          placeholder="Dieta, reposo, curaciones, signos de alarma…" />
        <Divider />
        <Flex justifyContent="space-between">
          <Typography variant="delta">Medicación de alta</Typography>
          <Button variant="secondary" size="S" startIcon={<Plus />}
            onClick={() => setF((x) => ({ ...x, medicacion: [...x.medicacion, { ...MEDICACION_VACIA }] }))}>Añadir</Button>
        </Flex>
        {(f.medicacion ?? []).map((m, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Box key={i} padding={3} hasRadius borderColor="neutral200" borderStyle="solid" borderWidth="1px">
            <Grid.Root gap={2}>
              <Grid.Item col={5} s={12} direction="column" alignItems="stretch">
                <Campo etiqueta="Medicamento" requerido valor={m.drug} onCambio={(v) => cambiarMed(i, 'drug', v)} />
              </Grid.Item>
              <Grid.Item col={3} s={6} direction="column" alignItems="stretch">
                <Campo etiqueta="Dosis" valor={m.dose} onCambio={(v) => cambiarMed(i, 'dose', v)} />
              </Grid.Item>
              <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
                <Selector etiqueta="Vía" valor={m.route} onCambio={(v) => cambiarMed(i, 'route', v)} opciones={VIA} />
              </Grid.Item>
              <Grid.Item col={3} s={6} direction="column" alignItems="stretch">
                <Campo etiqueta="Cada (h)" tipo="number" min={1} valor={m.frequencyHours} onCambio={(v) => cambiarMed(i, 'frequencyHours', v)} />
              </Grid.Item>
              <Grid.Item col={3} s={6} direction="column" alignItems="stretch">
                <Campo etiqueta="Días" tipo="number" min={1} valor={m.durationDays} onCambio={(v) => cambiarMed(i, 'durationDays', v)} />
              </Grid.Item>
              <Grid.Item col={5} s={10} direction="column" alignItems="stretch">
                <Campo etiqueta="Notas" valor={m.notes} onCambio={(v) => cambiarMed(i, 'notes', v)} />
              </Grid.Item>
              <Grid.Item col={1} s={2} alignItems="flex-end">
                <IconButton label="Quitar" variant="ghost" onClick={() => setF((x) => ({ ...x, medicacion: x.medicacion.filter((_, j) => j !== i) }))}>
                  <Trash />
                </IconButton>
              </Grid.Item>
            </Grid.Root>
          </Box>
        ))}
        <Campo etiqueta="Control el" tipo="date" valor={f.control} onCambio={cambiar('control')} />
      </Flex>
    </Dialogo>
  );
}
