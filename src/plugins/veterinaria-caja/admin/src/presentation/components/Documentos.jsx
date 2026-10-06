import * as React from 'react';
import styled from 'styled-components';
import { dinero, fechaHora, MEDIO, TIPO_MOVIMIENTO, cantidad } from '../../domain/formato';

/**
 * Documentos imprimibles: recibo de 80 mm y informe de cierre (Z). Estilos
 * simples y monoespaciados, como un tiquete de caja; se pintan siempre en
 * claro (los monta `Impresion`).
 */

const Papel = styled.div`
  font-family: 'Courier New', ui-monospace, monospace;
  font-size: 11px;
  color: #000;
  width: ${({ $ancho }) => $ancho ?? '74mm'};
  margin: 0 auto;
  h1 { font-size: 14px; margin: 0 0 2px; text-align: center; }
  p { margin: 0; }
  .centro { text-align: center; }
  .fila { display: flex; justify-content: space-between; gap: 6px; }
  .fuerte { font-weight: bold; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
`;

const Fila = ({ izq, der, fuerte }) => (
  <div className={`fila${fuerte ? ' fuerte' : ''}`}><span>{izq}</span><span>{der}</span></div>
);

export function Recibo({ recibo }) {
  const f = recibo.factura;
  const anticipo = !f && recibo.pagos.some((p) => p.destino === 'advance');
  const devolucion = recibo.pagos.some((p) => p.tipo === 'refund');
  return (
    <Papel>
      <h1>{recibo.clinica?.nombre ?? 'Clínica'}</h1>
      {recibo.clinica?.razonSocial && <p className="centro">{recibo.clinica.razonSocial}</p>}
      {recibo.clinica?.nit && <p className="centro">NIT {recibo.clinica.nit}</p>}
      {recibo.clinica?.telefono && <p className="centro">Tel. {recibo.clinica.telefono}</p>}
      <hr />
      <p className="centro fuerte">
        {f ? `Factura ${f.numero}` : anticipo ? 'Recibo de anticipo' : devolucion ? 'Comprobante de devolución' : 'Recibo de caja'}
      </p>
      <p className="centro">{fechaHora(recibo.pagos[0]?.fecha ?? f?.emitida)}</p>
      <Fila izq="Cliente" der={recibo.cliente ?? 'Consumidor final'} />
      {recibo.documentoCliente && <Fila izq="Documento" der={recibo.documentoCliente} />}
      {f && (
        <>
          <hr />
          {f.renglones.map((r, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i}>
              <p>{r.descripcion}</p>
              <Fila izq={`  ${cantidad(r.cantidad)} x ${dinero(r.precio)}${r.descuento ? ` -${dinero(r.descuento)}` : ''}`} der={dinero(r.total)} />
            </div>
          ))}
          <hr />
          <Fila izq="Subtotal" der={dinero(f.subtotal)} />
          {f.descuentos > 0 && <Fila izq="Descuentos" der={`-${dinero(f.descuentos)}`} />}
          <Fila izq="IVA" der={dinero(f.impuesto)} />
          <Fila izq="TOTAL" der={dinero(f.total)} fuerte />
        </>
      )}
      <hr />
      {recibo.pagos.map((p) => (
        <div key={p.documentId}>
          <Fila izq={`${p.tipo === 'refund' ? 'Devolución ' : ''}${MEDIO[p.medio] ?? p.medio}${p.ultimos4 ? ` ****${p.ultimos4}` : ''}`} der={dinero(p.valor)} />
          {p.referencia && <p>  Ref. {p.referencia}</p>}
          {p.recibido && p.cambio > 0 && <Fila izq="  Recibido" der={dinero(p.recibido)} />}
        </div>
      ))}
      {recibo.cambio > 0 && <Fila izq="CAMBIO" der={dinero(recibo.cambio)} fuerte />}
      {f && f.saldo > 0 && <Fila izq="SALDO PENDIENTE" der={dinero(f.saldo)} fuerte />}
      <hr />
      <p className="centro">{[recibo.pagos[0]?.caja, recibo.pagos[0]?.cajero].filter(Boolean).join(' · ')}</p>
      <p className="centro">Gracias por cuidar a su mascota con nosotros</p>
    </Papel>
  );
}

/** Informe de cierre de turno (Z). */
export function InformeCierre({ turno }) {
  const t = turno.totales ?? {};
  return (
    <Papel>
      <h1>Cierre de caja</h1>
      <p className="centro fuerte">{turno.caja?.nombre}</p>
      <p className="centro">{turno.responsable}</p>
      <hr />
      <Fila izq="Apertura" der={fechaHora(turno.apertura)} />
      <Fila izq="Cierre" der={fechaHora(turno.cierre)} />
      <hr />
      <p className="fuerte">Cobros por medio</p>
      {Object.entries(t.porMedio ?? {}).filter(([, v]) => v > 0).map(([k, v]) => <Fila key={k} izq={`  ${MEDIO[k] ?? k}`} der={dinero(v)} />)}
      <Fila izq="  De facturas" der={dinero(t.cobrosDeFacturas)} />
      <Fila izq="  Anticipos" der={dinero(t.anticipos)} />
      {Object.values(t.devoluciones ?? {}).some((v) => v > 0) && (
        <>
          <p className="fuerte">Devoluciones</p>
          {Object.entries(t.devoluciones).filter(([, v]) => v > 0).map(([k, v]) => <Fila key={k} izq={`  ${MEDIO[k] ?? k}`} der={`-${dinero(v)}`} />)}
        </>
      )}
      <p className="fuerte">Movimientos de efectivo</p>
      {Object.entries(t.movimientos ?? {}).map(([k, v]) => <Fila key={k} izq={`  ${TIPO_MOVIMIENTO[k] ?? k}`} der={`${k === 'cash_in' ? '' : '-'}${dinero(v)}`} />)}
      <hr />
      <Fila izq="Base" der={dinero(turno.base)} />
      <Fila izq="Efectivo esperado" der={dinero(turno.esperado)} fuerte />
      <Fila izq="Efectivo contado" der={dinero(turno.contado)} fuerte />
      <Fila izq="Descuadre" der={dinero(turno.descuadre)} fuerte />
      {turno.motivoDescuadre && <p>Motivo: {turno.motivoDescuadre}</p>}
      <hr />
      <br />
      <p>Firma responsable: ______________________</p>
      <br />
      <p>Recibe: ______________________</p>
    </Papel>
  );
}
