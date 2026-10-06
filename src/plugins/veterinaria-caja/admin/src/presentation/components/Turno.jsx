import * as React from 'react';
import styled from 'styled-components';
import {
  Box, Flex, Typography, Button, Field, TextInput, Textarea, Alert, Loader, Modal, Divider,
} from '@strapi/design-system';
import { Lock, Key } from '@strapi/icons';
import { dinero, hora } from '../../domain/formato';
import { Opcion } from './estilos';

/**
 * Apertura y cierre del turno, con el conteo de billetes y monedas (C4).
 */

const RejillaConteo = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: ${({ theme }) => theme.spaces[2]};
`;

/** Una casilla por denominación; devuelve el conteo y su total. */
export function Conteo({ denominaciones, valores, onCambio }) {
  const total = denominaciones.reduce((s, d) => s + d.denomination * Number(valores[d.denomination] || 0), 0);
  return (
    <Flex direction="column" gap={3} alignItems="stretch">
      <RejillaConteo>
        {denominaciones.map((d) => (
          <Field.Root key={d.denomination} name={`d${d.denomination}`}>
            <Field.Label>{`${d.kind === 'bill' ? 'Billete' : 'Moneda'} ${dinero(d.denomination)}`}</Field.Label>
            <TextInput
              type="number"
              min={0}
              inputMode="numeric"
              value={valores[d.denomination] ?? ''}
              onChange={(e) => onCambio({ ...valores, [d.denomination]: e.target.value })}
              placeholder="0"
            />
          </Field.Root>
        ))}
      </RejillaConteo>
      <Typography variant="delta">Total contado: {dinero(total)}</Typography>
    </Flex>
  );
}

const aConteo = (denominaciones, valores) =>
  denominaciones
    .map((d) => ({ denomination: d.denomination, kind: d.kind, quantity: Number(valores[d.denomination] || 0) }))
    .filter((c) => c.quantity > 0);

const totalDe = (denominaciones, valores) =>
  denominaciones.reduce((s, d) => s + d.denomination * Number(valores[d.denomination] || 0), 0);

/** Pantalla de apertura: elegir la caja, la base y (opcional) contarla. */
export function Apertura({ cajas, cargando, denominaciones, onAbrir, ocupado, puedeOperar }) {
  const [caja, setCaja] = React.useState(null);
  const [base, setBase] = React.useState('');
  const [contar, setContar] = React.useState(false);
  const [valores, setValores] = React.useState({});

  React.useEffect(() => {
    if (caja) setBase(String(caja.baseSugerida ?? 0));
  }, [caja]);

  if (!puedeOperar) {
    return (
      <Box padding={8}>
        <Alert variant="default" title="Sin turno propio">
          Tu cuenta puede supervisar las cajas, pero no abrir un turno. Revisa los turnos en "Supervisión".
        </Alert>
      </Box>
    );
  }

  const disponibles = (cajas ?? []).filter((c) => !c.turnoAbierto && c.autorizada);
  const baseFinal = contar ? totalDe(denominaciones, valores) : Number(base || 0);

  return (
    <Box padding={8} style={{ maxWidth: 960, margin: '0 auto', width: '100%', overflowY: 'auto' }}>
      <Flex direction="column" gap={6} alignItems="stretch">
        <Box>
          <Typography variant="alpha" tag="h1">Abrir caja</Typography>
          <Typography textColor="neutral600" tag="p">Elige la caja y confirma la base con la que empiezas el turno.</Typography>
        </Box>
        {cargando && <Loader>Cargando cajas…</Loader>}
        {!cargando && (cajas ?? []).length === 0 && (
          <Alert variant="warning" title="No hay cajas">La administración las crea en el Content Manager (Caja).</Alert>
        )}
        <Flex gap={3} wrap="wrap">
          {(cajas ?? []).map((c) => {
            const libre = !c.turnoAbierto && c.autorizada;
            return (
              <Opcion key={c.documentId} type="button" $activa={caja?.documentId === c.documentId} disabled={!libre}
                onClick={() => setCaja(c)} style={{ minWidth: 220, textAlign: 'left' }}>
                <Typography fontWeight="bold" tag="p">{c.nombre}</Typography>
                <Typography variant="pi" textColor="neutral600" tag="p">{c.ubicacion ?? ''}</Typography>
                <Typography variant="pi" tag="p">
                  {c.turnoAbierto
                    ? `Abierta por ${c.turnoAbierto.responsable ?? '—'} desde las ${hora(c.turnoAbierto.apertura)}`
                    : !c.autorizada ? 'No estás autorizado en esta caja' : `Base sugerida ${dinero(c.baseSugerida)}`}
                </Typography>
              </Opcion>
            );
          })}
        </Flex>

        {caja && (
          <Box background="neutral0" hasRadius padding={6} shadow="tableShadow">
            <Flex direction="column" gap={4} alignItems="stretch">
              {/* El botón va en la misma fila que el campo (no que la ayuda), para que quede a su altura. */}
              <Field.Root name="base" hint="Efectivo con el que empieza la caja (el sencillo para dar cambio).">
                <Field.Label>Base inicial</Field.Label>
                <Flex gap={4} alignItems="center" wrap="wrap">
                  <Box style={{ minWidth: 240 }}>
                    <TextInput type="number" min={0} value={contar ? String(baseFinal) : base} disabled={contar}
                      onChange={(e) => setBase(e.target.value)} />
                  </Box>
                  <Button size="L" variant={contar ? 'secondary' : 'tertiary'} onClick={() => setContar((v) => !v)}>
                    {contar ? 'Escribir el total' : 'Contar billetes y monedas'}
                  </Button>
                </Flex>
                <Field.Hint />
              </Field.Root>
              {contar && <Conteo denominaciones={denominaciones} valores={valores} onCambio={setValores} />}
              <Flex justifyContent="flex-end">
                <Button size="L" startIcon={<Key />} loading={ocupado} disabled={!disponibles.some((c) => c.documentId === caja.documentId)}
                  onClick={() => onAbrir({ caja: caja.documentId, base: baseFinal, conteo: contar ? aConteo(denominaciones, valores) : undefined })}>
                  Abrir {caja.nombre} con {dinero(baseFinal)}
                </Button>
              </Flex>
            </Flex>
          </Box>
        )}
      </Flex>
    </Box>
  );
}

/** Cierre: arqueo por denominación, esperado frente a contado y motivo del descuadre. */
export function ModalCierre({ abierto, onCerrar, turno, denominaciones, onCerrarCaja, ocupado }) {
  const [valores, setValores] = React.useState({});
  const [motivo, setMotivo] = React.useState('');
  React.useEffect(() => { if (abierto) { setValores({}); setMotivo(''); } }, [abierto]);
  const contado = totalDe(denominaciones, valores);
  const diferencia = contado - Number(turno?.esperado ?? 0);
  const valido = diferencia === 0 || motivo.trim();
  return (
    <Modal.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <Modal.Content style={{ maxWidth: 900, width: '90vw' }}>
        <Modal.Header><Modal.Title>Cerrar {turno?.caja?.nombre}</Modal.Title></Modal.Header>
        <Modal.Body>
          <Flex direction="column" gap={4} alignItems="stretch">
            <Typography>Cuenta el efectivo de la caja. Tarjetas y transferencias no se cuentan: ya están en el banco.</Typography>
            <Conteo denominaciones={denominaciones} valores={valores} onCambio={setValores} />
            <Divider />
            <Flex gap={8} wrap="wrap">
              <Box><Typography variant="sigma" textColor="neutral600">Esperado</Typography><Typography variant="beta" tag="p">{dinero(turno?.esperado)}</Typography></Box>
              <Box><Typography variant="sigma" textColor="neutral600">Contado</Typography><Typography variant="beta" tag="p">{dinero(contado)}</Typography></Box>
              <Box>
                <Typography variant="sigma" textColor="neutral600">Descuadre</Typography>
                <Typography variant="beta" tag="p" textColor={diferencia === 0 ? 'success600' : 'danger600'}>
                  {diferencia === 0 ? 'Cuadra' : `${diferencia > 0 ? 'Sobran' : 'Faltan'} ${dinero(Math.abs(diferencia))}`}
                </Typography>
              </Box>
            </Flex>
            {diferencia !== 0 && (
              <Field.Root name="motivo" required>
                <Field.Label>Motivo del descuadre</Field.Label>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: cambio mal dado, venta sin registrar…" />
              </Field.Root>
            )}
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="tertiary" onClick={onCerrar}>Cancelar</Button>
          <Button variant="danger" startIcon={<Lock />} loading={ocupado} disabled={!valido}
            onClick={() => onCerrarCaja({ conteo: aConteo(denominaciones, valores), motivo: diferencia === 0 ? undefined : motivo.trim() })}>
            Cerrar caja
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
