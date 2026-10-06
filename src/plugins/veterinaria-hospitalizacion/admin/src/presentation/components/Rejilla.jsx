import * as React from 'react';
import styled, { css } from 'styled-components';
import { Box, Flex, Typography, Tooltip, IconButton } from '@strapi/design-system';
import { CrossCircle } from '@strapi/icons';
import {
  HORAS, dosDigitos, numero, VIA, UNIDAD, ESTADO_TOMA, ESTADO_ORDEN, MUCOSAS, HIDRATACION, ESTADO_MENTAL, APETITO,
} from '../../domain/formato';
import { Insignia } from './comunes';

/**
 * Hoja de evolución de un día: 24 columnas horarias (zona de Clínica), una
 * fila por orden de tratamiento con sus tomas, y debajo una fila por signo
 * vital. Es la hoja de papel de la sala de hospitalización, en pantalla.
 *
 * Estilos propios sobre los tokens del tema del Design System, para que
 * funcione igual en modo claro y oscuro. La primera columna queda fija al
 * desplazar en horizontal.
 */

const ANCHO_HORA = 44;

const Marco = styled.div`
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.colors.neutral150};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme }) => theme.colors.neutral0};
`;

const Tabla = styled.table`
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  min-width: ${280 + ANCHO_HORA * 24}px;
  font-size: 1.2rem;
  color: ${({ theme }) => theme.colors.neutral800};
`;

const celdaBase = css`
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral150};
  border-right: 1px solid ${({ theme }) => theme.colors.neutral100};
  padding: 4px 2px;
  text-align: center;
  vertical-align: middle;
  height: 40px;
`;

const Th = styled.th`
  ${celdaBase};
  height: 32px;
  position: sticky;
  top: 0;
  background: ${({ theme, $ahora }) => ($ahora ? theme.colors.primary100 : theme.colors.neutral100)};
  color: ${({ theme, $ahora }) => ($ahora ? theme.colors.primary700 : theme.colors.neutral600)};
  font-weight: 600;
  width: ${ANCHO_HORA}px;
`;

const Td = styled.td`
  ${celdaBase};
  width: ${ANCHO_HORA}px;
  background: ${({ theme, $ahora }) => ($ahora ? theme.colors.primary100 : 'transparent')};
`;

const Fija = styled.th`
  ${celdaBase};
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 280px;
  max-width: 280px;
  text-align: left;
  padding: 6px 10px;
  font-weight: normal;
  background: ${({ theme, $titulo }) => ($titulo ? theme.colors.neutral100 : theme.colors.neutral0)};
  box-shadow: 1px 0 0 ${({ theme }) => theme.colors.neutral150};
`;

const Seccion = styled.td`
  padding: 6px 10px;
  background: ${({ theme }) => theme.colors.neutral100};
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral150};
  text-align: left;
  position: sticky;
  left: 0;
`;

/** Una toma programada: un botón cuadrado coloreado por estado. */
const Toma = styled.button`
  width: 34px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid ${({ theme, $color }) => theme.colors[`${$color}200`]};
  background: ${({ theme, $color }) => theme.colors[`${$color}100`]};
  color: ${({ theme, $color }) => theme.colors[`${$color}700`]};
  font-size: 1.1rem;
  font-weight: 700;
  cursor: ${({ $inactiva }) => ($inactiva ? 'default' : 'pointer')};
  ${({ $tachada }) => $tachada && css`text-decoration: line-through;`}
  &:hover:not([aria-disabled='true']) {
    border-color: ${({ theme, $color }) => theme.colors[`${$color}600`]};
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: 1px;
  }
`;

const SIGNO_TOMA = { dada: '✓', omitida: '✕', atrasada: '!', pendiente: '·' };

function textoDeToma(t) {
  const a = t.administracion;
  if (!a) return `${t.horaTexto} · ${ESTADO_TOMA[t.estado].rotulo}`;
  const base = `${t.horaTexto} · ${a.estado === 'given' ? `Dada a las ${a.horaTexto}` : `Omitida a las ${a.horaTexto}`}`;
  const quien = a.por ? ` por ${a.por}` : '';
  const detalle = a.estado === 'omitted' ? ` — ${a.motivoOmision ?? ''}` : ` (${numero(a.cantidad, 2)})`;
  return `${base}${quien}${detalle}${a.notas ? ` · ${a.notas}` : ''}`;
}

function CeldaDeToma({ tomas, onTomar, puedeRegistrar }) {
  if (!tomas || tomas.length === 0) return null;
  return (
    <Flex direction="column" gap={1} alignItems="center">
      {tomas.map((t) => {
        const e = ESTADO_TOMA[t.estado];
        const accionable = puedeRegistrar && !t.administracion;
        return (
          <Tooltip key={t.programada} label={textoDeToma(t)}>
            <Toma
              type="button"
              $color={e.color}
              $tachada={t.estado === 'omitida'}
              // Sin `disabled`: un botón deshabilitado no recibe el puntero y
              // el tooltip con quién la dio y a qué hora no se vería.
              aria-disabled={!accionable}
              $inactiva={!accionable}
              aria-label={textoDeToma(t)}
              onClick={() => accionable && onTomar(t)}
            >
              {SIGNO_TOMA[t.estado]}
            </Toma>
          </Tooltip>
        );
      })}
    </Flex>
  );
}

/** Agrupa por hora (0–23) lo que llega con `hora`. */
const porHora = (items) => {
  const m = new Map();
  for (const it of items ?? []) {
    if (!m.has(it.hora)) m.set(it.hora, []);
    m.get(it.hora).push(it);
  }
  return m;
};

const FILAS_DE_SIGNOS = [
  ['temperatura', 'Temperatura (°C)', (v) => numero(v, 1)],
  ['fc', 'Frec. cardíaca (lpm)', (v) => numero(v, 0)],
  ['fr', 'Frec. respiratoria (rpm)', (v) => numero(v, 0)],
  ['dolor', 'Dolor (0–10)', (v) => numero(v, 0)],
  ['mucosas', 'Mucosas', (v) => MUCOSAS[v]?.slice(0, 4) ?? v],
  ['tllc', 'Llenado capilar (s)', (v) => numero(v, 1)],
  ['hidratacion', 'Hidratación', (v) => HIDRATACION[v]?.split(' ')[0] ?? v],
  ['estadoMental', 'Estado mental', (v) => ESTADO_MENTAL[v]?.slice(0, 5) ?? v],
  ['apetito', 'Apetito', (v) => APETITO[v]?.split(' ')[0] ?? v],
  ['orino', 'Orinó', (v) => (v ? 'Sí' : 'No')],
  ['defeco', 'Defecó', (v) => (v ? 'Sí' : 'No')],
  ['vomito', 'Vomitó', (v) => (v ? 'Sí' : 'No')],
  ['pesoKg', 'Peso (kg)', (v) => numero(v, 2)],
];

export function Rejilla({ hoja, puedeRegistrar, puedePrescribir, verCerradas, onTomar, onSuspender }) {
  const ahora = hoja.esHoy ? Number(new Intl.DateTimeFormat('en-US', { timeZone: hoja.zona, hour: '2-digit', hourCycle: 'h23' }).format(new Date())) : null;
  const ordenes = hoja.ordenes.filter((o) => verCerradas || o.estado === 'active' || o.tomas.some((t) => t.administracion) || o.adicionales.length > 0);
  const signos = porHora(hoja.signos);
  const filasSignos = FILAS_DE_SIGNOS.filter(([campo]) => hoja.signos.some((s) => s[campo] !== null && s[campo] !== undefined));
  const activa = hoja.hospitalizacion.estado === 'active';

  return (
    <Marco>
      <Tabla>
        <thead>
          <tr>
            <Fija as="th" $titulo>
              <Typography variant="sigma" textColor="neutral600">Hora</Typography>
            </Fija>
            {HORAS.map((h) => <Th key={h} $ahora={h === ahora} scope="col">{dosDigitos(h)}</Th>)}
          </tr>
        </thead>
        <tbody>
          <tr><Seccion colSpan={25}><Typography variant="sigma">Medicación</Typography></Seccion></tr>
          {ordenes.length === 0 && (
            <tr>
              <Fija>
                <Typography variant="pi" textColor="neutral600">Sin órdenes de tratamiento este día.</Typography>
              </Fija>
              {HORAS.map((h) => <Td key={h} $ahora={h === ahora} />)}
            </tr>
          )}
          {ordenes.map((o) => {
            const tomas = porHora(o.tomas);
            const extra = porHora(o.adicionales);
            return (
              <tr key={o.documentId}>
                <Fija>
                  <Flex justifyContent="space-between" gap={2}>
                    <Box>
                      <Typography fontWeight="bold" ellipsis>{o.producto?.nombre ?? 'Producto'}</Typography>
                      <Typography variant="pi" textColor="neutral600">
                        {[o.dosis, `${numero(o.cantidadPorToma, 2)} ${UNIDAD[o.producto?.unidad] ?? ''}`.trim(), VIA[o.via] ?? o.via,
                          o.siEsNecesario ? 'si es necesario' : `c/${o.cadaHoras} h`].filter(Boolean).join(' · ')}
                      </Typography>
                      {o.estado !== 'active' && <Box paddingTop={1}><Insignia estado={o.estado} mapa={ESTADO_ORDEN} /></Box>}
                    </Box>
                    {puedePrescribir && activa && o.estado === 'active' && (
                      <IconButton label="Suspender la orden" variant="ghost" size="S" onClick={() => onSuspender(o)}>
                        <CrossCircle />
                      </IconButton>
                    )}
                  </Flex>
                </Fija>
                {HORAS.map((h) => (
                  <Td key={h} $ahora={h === ahora}>
                    <CeldaDeToma tomas={tomas.get(h)} puedeRegistrar={puedeRegistrar} onTomar={(t) => onTomar(o, t)} />
                    {(extra.get(h) ?? []).map((a) => (
                      <Tooltip key={a.documentId} label={`${a.horaTexto} · ${a.estado === 'given' ? 'Dada' : 'Omitida'}${a.por ? ` por ${a.por}` : ''}`}>
                        <Toma type="button" aria-disabled $inactiva $color={a.estado === 'given' ? 'success' : 'neutral'}>{a.estado === 'given' ? '✓' : '✕'}</Toma>
                      </Tooltip>
                    ))}
                  </Td>
                ))}
              </tr>
            );
          })}
          {hoja.dosisUnicas.length > 0 && (
            <tr>
              <Fija><Typography fontWeight="bold">Dosis únicas</Typography></Fija>
              {HORAS.map((h) => (
                <Td key={h} $ahora={h === ahora}>
                  {hoja.dosisUnicas.filter((a) => a.hora === h).map((a) => (
                    <Tooltip key={a.documentId} label={`${a.horaTexto} · ${a.producto} · ${a.estado === 'given' ? 'Dada' : 'Omitida'}${a.por ? ` por ${a.por}` : ''}`}>
                      <Toma type="button" aria-disabled $inactiva $color={a.estado === 'given' ? 'success' : 'neutral'}>{a.estado === 'given' ? '✓' : '✕'}</Toma>
                    </Tooltip>
                  ))}
                </Td>
              ))}
            </tr>
          )}

          <tr><Seccion colSpan={25}><Typography variant="sigma">Signos y evolución</Typography></Seccion></tr>
          {filasSignos.length === 0 && (
            <tr>
              <Fija><Typography variant="pi" textColor="neutral600">Sin signos registrados este día.</Typography></Fija>
              {HORAS.map((h) => <Td key={h} $ahora={h === ahora} />)}
            </tr>
          )}
          {filasSignos.map(([campo, rotulo, formato]) => (
            <tr key={campo}>
              <Fija><Typography variant="pi" fontWeight="bold">{rotulo}</Typography></Fija>
              {HORAS.map((h) => {
                const ultimo = (signos.get(h) ?? []).filter((s) => s[campo] !== null && s[campo] !== undefined).pop();
                return (
                  <Td key={h} $ahora={h === ahora}>
                    {ultimo && (
                      <Tooltip label={`${ultimo.horaTexto}${ultimo.por ? ` · ${ultimo.por}` : ''}${ultimo.notas ? ` · ${ultimo.notas}` : ''}`}>
                        <Typography variant="pi">{formato(ultimo[campo])}</Typography>
                      </Tooltip>
                    )}
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Tabla>
    </Marco>
  );
}
