import * as React from 'react';
import { Box, Flex, Typography } from '@strapi/design-system';
import { minutosDe } from '../../domain/semana';
import { TarjetaCita } from './TarjetaCita';

const PX_POR_MINUTO = 0.9;

/**
 * Un día de un profesional: los huecos libres de fondo y las citas encima.
 *
 * Un hueco libre se pinta apagado y no es pulsable; lo que se pulsa son las
 * citas. Así se distingue de un vistazo lo que hay que atender de lo que solo
 * está disponible.
 */
export function ColumnaDia({ dia, citas, rango, esHoy, onAbrirCita }) {
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
        <Box
          key={h.startAt}
          position="absolute"
          style={{
            top: `${y(minutosDe(h.startAt))}px`,
            height: `${(minutosDe(h.endAt) - minutosDe(h.startAt)) * PX_POR_MINUTO}px`,
            left: '2px', right: '2px',
          }}
          background="neutral100"
          hasRadius
          padding={1}
        >
          <Typography variant="pi" textColor="neutral500">libre</Typography>
        </Box>
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
