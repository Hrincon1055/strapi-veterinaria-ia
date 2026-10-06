import * as React from 'react';
import {
  Box, Flex, Grid, Typography, Button, Field, TextInput, SingleSelect, SingleSelectOption, Modal, Divider, IconButton, Alert,
} from '@strapi/design-system';
import { Trash } from '@strapi/icons';
import { dinero, billetesRapidos, MEDIO, CANAL } from '../../domain/formato';
import { Opcion } from './estilos';

/**
 * Cobro con uno o varios medios (C2). Cada pago se añade a la lista y el
 * servidor recibe todos juntos: si uno falla, no queda nada registrado.
 *
 * `modo`: 'venta' (emite y cobra), 'abono' (a una factura) o 'anticipo'.
 * `permiteSaldo`: dejar parte sin pagar (va a cartera; no con consumidor final).
 */
export function ModalCobro({ abierto, onCerrar, total, titulo, modo, saldoAFavor = 0, permiteSaldo, onCobrar, ocupado }) {
  const [pagos, setPagos] = React.useState([]);
  const [medio, setMedio] = React.useState('cash');
  const [f, setF] = React.useState({});
  const cambiar = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  React.useEffect(() => {
    if (!abierto) return;
    setPagos([]);
    setMedio('cash');
    setF({ valor: String(Math.max(0, total)) });
  }, [abierto, total]);

  const pagado = pagos.reduce((s, p) => s + p.valor, 0);
  const falta = Math.max(0, total - pagado);
  const recibido = pagos.filter((p) => p.medio === 'cash').reduce((s, p) => s + (p.recibido ?? p.valor), 0);
  const cambio = pagos.reduce((s, p) => s + Math.max(0, (p.recibido ?? p.valor) - p.valor), 0);
  const usadoSaldo = pagos.filter((p) => p.medio === 'credit_balance').reduce((s, p) => s + p.valor, 0);

  React.useEffect(() => { setF((x) => ({ ...x, valor: String(falta) })); }, [falta]);

  const valor = Math.round(Number(f.valor || 0));
  const errorMedio =
    valor <= 0 ? 'Indica el valor'
      : modo !== 'anticipo' && valor > falta ? `No puede pasar de lo que falta (${dinero(falta)})`
        : medio === 'card' && (!f.tipoTarjeta || !/^\d{4}$/.test(f.ultimos4 ?? '') || !(f.aprobacion ?? '').trim()) ? 'Tarjeta: tipo, últimos 4 dígitos y aprobación'
          : medio === 'transfer' && (!f.canal || !(f.referencia ?? '').trim()) ? 'Transferencia: canal y referencia'
            : medio === 'credit_balance' && valor > saldoAFavor - usadoSaldo ? `Saldo a favor disponible: ${dinero(saldoAFavor - usadoSaldo)}`
              : null;

  const agregar = (extra = {}) => {
    const p = { medio, valor, ...extra };
    if (medio === 'card') Object.assign(p, { tipoTarjeta: f.tipoTarjeta, franquicia: f.franquicia, ultimos4: f.ultimos4, aprobacion: f.aprobacion });
    if (medio === 'transfer') Object.assign(p, { canal: f.canal, referencia: f.referencia });
    setPagos((xs) => [...xs, p]);
    setF((x) => ({ valor: x.valor }));
  };

  /** Efectivo: el billete con que paga; el cambio sale solo. */
  const pagarEfectivo = (billete) => {
    const v = Math.min(falta, billete);
    if (v <= 0) return;
    setPagos((xs) => [...xs, { medio: 'cash', valor: v, recibido: billete }]);
  };

  // Con cliente registrado se puede emitir a crédito (todo o parte a cartera);
  // un abono necesita al menos un pago.
  const listo = modo === 'anticipo' || modo === 'abono' ? pagado > 0 : pagado === total || (permiteSaldo && pagado < total);
  const medios = ['cash', 'card', 'transfer', ...(saldoAFavor > 0 && modo !== 'anticipo' ? ['credit_balance'] : [])];

  return (
    <Modal.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <Modal.Content style={{ maxWidth: 960, width: '92vw' }}>
        <Modal.Header><Modal.Title>{titulo}</Modal.Title></Modal.Header>
        <Modal.Body>
          <Grid.Root gap={6}>
            <Grid.Item col={7} s={12} direction="column" alignItems="stretch">
              <Flex direction="column" gap={4} alignItems="stretch">
                <Flex gap={2} wrap="wrap">
                  {medios.map((m) => (
                    <Opcion key={m} type="button" $activa={medio === m} onClick={() => setMedio(m)} style={{ flex: 1, minWidth: 120 }}>
                      {MEDIO[m]}{m === 'credit_balance' ? ` (${dinero(saldoAFavor - usadoSaldo)})` : ''}
                    </Opcion>
                  ))}
                </Flex>

                {medio === 'cash' && modo !== 'anticipo' && falta > 0 && (
                  <Box>
                    <Typography variant="sigma" textColor="neutral600">Paga con</Typography>
                    <Flex gap={2} wrap="wrap" paddingTop={2}>
                      {billetesRapidos(falta).map((b) => (
                        <Opcion key={b} type="button" onClick={() => pagarEfectivo(b)} style={{ minWidth: 110 }}>{b === falta ? `Exacto ${dinero(b)}` : dinero(b)}</Opcion>
                      ))}
                    </Flex>
                  </Box>
                )}

                <Grid.Root gap={3}>
                  <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                    <Field.Root name="valor">
                      <Field.Label>{medio === 'cash' ? 'Valor a cobrar en efectivo' : 'Valor'}</Field.Label>
                      <TextInput type="number" min={0} value={f.valor ?? ''} onChange={(e) => cambiar('valor')(e.target.value)} />
                    </Field.Root>
                  </Grid.Item>
                  {medio === 'cash' && (
                    <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                      <Field.Root name="recibido" hint="Si entrega más, se calcula el cambio.">
                        <Field.Label>Recibido</Field.Label>
                        <TextInput type="number" min={0} value={f.recibido ?? ''} onChange={(e) => cambiar('recibido')(e.target.value)} placeholder={String(valor || '')} />
                        <Field.Hint />
                      </Field.Root>
                    </Grid.Item>
                  )}
                  {medio === 'card' && (
                    <>
                      <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                        <Field.Root name="tipo" required>
                          <Field.Label>Tipo</Field.Label>
                          <SingleSelect value={f.tipoTarjeta ?? ''} onChange={cambiar('tipoTarjeta')} placeholder="Débito o crédito">
                            <SingleSelectOption value="debit">Débito</SingleSelectOption>
                            <SingleSelectOption value="credit">Crédito</SingleSelectOption>
                          </SingleSelect>
                        </Field.Root>
                      </Grid.Item>
                      <Grid.Item col={4} s={12} direction="column" alignItems="stretch">
                        <Field.Root name="franquicia"><Field.Label>Franquicia</Field.Label>
                          <TextInput value={f.franquicia ?? ''} onChange={(e) => cambiar('franquicia')(e.target.value)} placeholder="Visa, Mastercard…" />
                        </Field.Root>
                      </Grid.Item>
                      <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
                        <Field.Root name="ultimos4" required><Field.Label>Últimos 4</Field.Label>
                          <TextInput inputMode="numeric" maxLength={4} value={f.ultimos4 ?? ''} onChange={(e) => cambiar('ultimos4')(e.target.value.replace(/\D/g, ''))} />
                        </Field.Root>
                      </Grid.Item>
                      <Grid.Item col={4} s={6} direction="column" alignItems="stretch">
                        <Field.Root name="aprobacion" required><Field.Label>Aprobación</Field.Label>
                          <TextInput value={f.aprobacion ?? ''} onChange={(e) => cambiar('aprobacion')(e.target.value)} />
                        </Field.Root>
                      </Grid.Item>
                    </>
                  )}
                  {medio === 'transfer' && (
                    <>
                      <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                        <Field.Root name="canal" required><Field.Label>Canal</Field.Label>
                          <SingleSelect value={f.canal ?? ''} onChange={cambiar('canal')} placeholder="Nequi, Daviplata…">
                            {Object.entries(CANAL).map(([k, v]) => <SingleSelectOption key={k} value={k}>{v}</SingleSelectOption>)}
                          </SingleSelect>
                        </Field.Root>
                      </Grid.Item>
                      <Grid.Item col={6} s={12} direction="column" alignItems="stretch">
                        <Field.Root name="referencia" required><Field.Label>Referencia del comprobante</Field.Label>
                          <TextInput value={f.referencia ?? ''} onChange={(e) => cambiar('referencia')(e.target.value)} />
                        </Field.Root>
                      </Grid.Item>
                    </>
                  )}
                </Grid.Root>
                {errorMedio && valor > 0 && <Typography variant="pi" textColor="danger600">{errorMedio}</Typography>}
                <Flex justifyContent="flex-end">
                  <Button variant="secondary" disabled={Boolean(errorMedio)}
                    onClick={() => agregar(medio === 'cash' ? { recibido: Math.max(valor, Math.round(Number(f.recibido || 0))) } : {})}>
                    Añadir {MEDIO[medio].toLowerCase()} {valor > 0 ? dinero(valor) : ''}
                  </Button>
                </Flex>
              </Flex>
            </Grid.Item>

            <Grid.Item col={5} s={12} direction="column" alignItems="stretch">
              <Box background="neutral100" hasRadius padding={4}>
                <Flex direction="column" gap={2} alignItems="stretch">
                  <Typography variant="sigma" textColor="neutral600">{modo === 'anticipo' ? 'Anticipo' : 'Total a pagar'}</Typography>
                  {modo !== 'anticipo' && <Typography variant="alpha" tag="p">{dinero(total)}</Typography>}
                  <Divider />
                  {pagos.length === 0 && <Typography textColor="neutral600">Aún no hay pagos.</Typography>}
                  {pagos.map((p, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <Flex key={i} justifyContent="space-between" gap={2}>
                      <Box>
                        <Typography fontWeight="bold">{MEDIO[p.medio]}{p.canal ? ` · ${CANAL[p.canal]}` : ''}{p.ultimos4 ? ` · ****${p.ultimos4}` : ''}</Typography>
                        {p.medio === 'cash' && p.recibido > p.valor && <Typography variant="pi" textColor="neutral600"> recibe {dinero(p.recibido)}</Typography>}
                      </Box>
                      <Flex gap={2}>
                        <Typography>{dinero(p.valor)}</Typography>
                        <IconButton label="Quitar" variant="ghost" onClick={() => setPagos((xs) => xs.filter((_, j) => j !== i))}><Trash /></IconButton>
                      </Flex>
                    </Flex>
                  ))}
                  <Divider />
                  {modo !== 'anticipo' && (
                    <Flex justifyContent="space-between"><Typography>Falta</Typography><Typography fontWeight="bold" textColor={falta > 0 ? 'danger600' : 'success600'}>{dinero(falta)}</Typography></Flex>
                  )}
                  {modo === 'anticipo' && (
                    <Flex justifyContent="space-between"><Typography>Anticipo</Typography><Typography fontWeight="bold">{dinero(pagado)}</Typography></Flex>
                  )}
                  {recibido > 0 && (
                    <Flex justifyContent="space-between"><Typography variant="delta">Cambio</Typography><Typography variant="beta">{dinero(cambio)}</Typography></Flex>
                  )}
                </Flex>
              </Box>
              {modo === 'venta' && permiteSaldo && falta > 0 && (
                <Box paddingTop={3}>
                  <Alert variant="warning" title="Quedará saldo pendiente">
                    La factura se emite con {dinero(falta)} por pagar y pasa a la cartera del cliente.
                  </Alert>
                </Box>
              )}
            </Grid.Item>
          </Grid.Root>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="tertiary" onClick={onCerrar}>Volver</Button>
          <Button size="L" loading={ocupado} disabled={!listo} onClick={() => onCobrar(pagos)}>
            {modo === 'venta' ? (falta > 0 && permiteSaldo ? `Emitir con saldo de ${dinero(falta)}` : 'Cobrar e imprimir') : modo === 'abono' ? 'Registrar abono' : 'Registrar anticipo'}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
