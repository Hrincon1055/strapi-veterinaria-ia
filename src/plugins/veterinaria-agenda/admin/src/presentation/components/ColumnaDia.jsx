import * as React from 'react';
import { Box, Flex, Typography } from '@strapi/design-system';
import { horaDe, minutosDe } from '../../domain/semana';
import { TarjetaCita } from './TarjetaCita';

const PX_POR_MINUTO = 0.9;

/**
 * Un hueco libre.
 *
 * Con permiso para agendar es un `<button>` de verdad —no un `div` con
 * `onClick`—, para que se pueda tabular y activar con Enter: recepción agenda
 * a toda velocidad y no siempre con el ratón. Sin permiso se queda como fondo
 * apagado e inerte, que es lo que ve un veterinario: él atiende lo que ya
 * tiene, no llena la agenda.
 */
function Hueco({ hueco, top, alto, onAgendar }) {
  const comun = {
    position: 'absolute',
    style: { top: `${top}px`, height: `${alto}px`, left: '2px', right: '2px' },
    hasRadius: true,
    padding: 1,
  };

  if (!onAgendar) {
    return (
      <Box {...comun} background="neutral100">
        <Typography variant="pi" textColor="neutral500">libre</Typography>
      </Box>
    );
  }

  return (
    <Box
      {...comun}
      tag="button"
      type="button"
      onClick={() => onAgendar(hueco)}
      background="neutral100"
      cursor="pointer"
      borderColor="neutral200"
      borderWidth="1px"
      borderStyle="dashed"
      title={`Agendar a las ${horaDe(hueco.startAt)}`}
      aria-label={`Agendar una cita a las ${horaDe(hueco.startAt)}`}
    >
      <Typography variant="pi" textColor="neutral600">
        {horaDe(hueco.startAt)} · libre
      </Typography>
    </Box>
  );
}

/**
 * Un día de un profesional: los huecos libres de fondo y las citas encima.
 *
 * Las citas van después en el DOM, así que tapan al hueco cuando se solapan:
 * lo que se pulsa encima de una cita es siempre la cita.
 */
export function ColumnaDia({ dia, citas, rango, esHoy, onAbrirCita, onAgendar }) {
  const alturaTotal = (rango.max - rango.min) * PX_POR_MINUTO;
  const y = (min) => (min - rango.min) * PX_POR_MINUTO;

  return (
    <Box
      position="relative"
      style={{ height: `${alturaTotal}px`, minWidth: 0 }}
      background={esHoy ? 'primary100' : 'neutral0'}
      borderColor="neutral200"
      borderWidth="0 1px 0 0"
      borderStyle="solid"
    >
      {(dia?.huecos ?? []).map((h) => (
        <Hueco
          key={h.startAt}
          hueco={h}
          top={y(minutosDe(h.startAt))}
          alto={(minutosDe(h.endAt) - minutosDe(h.startAt)) * PX_POR_MINUTO}
          onAgendar={onAgendar}
        />
      ))}

      {(citas ?? []).map((c) => (
        <TarjetaCita
          key={c.documentId}
          cita={c}
          top={y(minutosDe(c.startAt))}
          alto={(minutosDe(c.endAt) - minutosDe(c.startAt)) * PX_POR_MINUTO}
          onAbrir={onAbrirCita}
        />
      ))}

      {!dia && (citas ?? []).length === 0 && (
        <Flex height="100%" alignItems="center" justifyContent="center">
          <Typography variant="pi" textColor="neutral400">sin atención</Typography>
        </Flex>
      )}
    </Box>
  );
}

export { PX_POR_MINUTO };
