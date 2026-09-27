import * as React from 'react';
import { Box, Flex, Typography } from '@strapi/design-system';
import { COLOR_ESTADO, ETIQUETA_ESTADO, horaDe } from '../../domain/semana';

/**
 * Una cita colocada en la rejilla.
 *
 * La posición sale de la hora: `top` y `height` en píxeles a partir de los
 * minutos. Es lo que da el aspecto de calendario de Outlook en vez de una
 * lista.
 */
export function TarjetaCita({ cita, top, alto, onAbrir }) {
  const color = COLOR_ESTADO[cita.state] ?? 'neutral';

  return (
    <Box
      position="absolute"
      style={{ top: `${top}px`, height: `${Math.max(alto, 22)}px`, left: '2px', right: '2px', cursor: 'pointer' }}
      background={`${color}100`}
      borderColor={`${color}600`}
      borderWidth="1px"
      borderStyle="solid"
      hasRadius
      padding={1}
      onClick={() => onAbrir(cita)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(cita); } }}
      aria-label={`Cita de ${cita.mascota?.nombre ?? 'sin mascota'} a las ${horaDe(cita.startAt)}, ${ETIQUETA_ESTADO[cita.state]}`}
    >
      <Flex direction="column" alignItems="flex-start" gap={0}>
        <Typography variant="pi" fontWeight="bold" textColor={`${color}700`} ellipsis>
          {horaDe(cita.startAt)} {cita.mascota?.nombre ?? 'Sin mascota'}
        </Typography>
        {alto > 38 && cita.propietario && (
          <Typography variant="pi" textColor="neutral600" ellipsis>{cita.propietario}</Typography>
        )}
        {alto > 56 && (
          <Typography variant="pi" textColor={`${color}600`} ellipsis>
            {ETIQUETA_ESTADO[cita.state]}
          </Typography>
        )}
      </Flex>
    </Box>
  );
}
