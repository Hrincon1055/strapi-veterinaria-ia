import * as React from 'react';
import { Box, Flex, Grid, Typography, Divider } from '@strapi/design-system';
import { fechasDeSemana, hoy, rangoVisible } from '../../domain/semana';
import { ColumnaDia, PX_POR_MINUTO } from './ColumnaDia';

/** Eje de horas a la izquierda, una marca por hora. */
function EjeHoras({ rango }) {
  const horas = [];
  for (let m = rango.min; m <= rango.max; m += 60) horas.push(m);

  return (
    <Box position="relative" style={{ width: '56px', height: `${(rango.max - rango.min) * PX_POR_MINUTO}px` }}>
      {horas.map((m) => (
        <Box key={m} position="absolute" style={{ top: `${(m - rango.min) * PX_POR_MINUTO - 8}px`, right: '8px' }}>
          <Typography variant="pi" textColor="neutral500">
            {String(Math.floor(m / 60)).padStart(2, '0')}:00
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * La rejilla semanal.
 *
 * Una sección por profesional: en la vista personal hay una sola, y en la
 * general tantas como personas seleccionadas, cada una rotulada con su
 * nombre. Es lo que pedía el negocio y evita el lío de mezclar en una sola
 * rejilla citas de gente distinta.
 */
export function RejillaSemana({ semana, onAbrirCita }) {
  const dias = fechasDeSemana(semana.lunes);
  const rango = rangoVisible(semana.columnas);
  const fechaHoy = hoy();

  return (
    <Flex direction="column" gap={6} alignItems="stretch">
      {semana.columnas.map((col) => (
        <Box key={col.staff.documentId} background="neutral0" hasRadius shadow="tableShadow" padding={4}>
          <Flex justifyContent="space-between" alignItems="center" paddingBottom={3}>
            <Flex direction="column" alignItems="flex-start">
              <Typography variant="delta">{col.staff.nombre}</Typography>
              <Typography variant="pi" textColor="neutral600">
                {[col.staff.ocupacion, col.staff.consultorio, `${col.staff.slotMinutes} min por paciente`]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Flex>
            <Typography variant="pi" textColor="neutral600">
              {col.citas.filter((c) => c.bloquea).length} citas esta semana
            </Typography>
          </Flex>

          <Divider />

          <Grid.Root gridCols={8} gap={0} paddingTop={2}>
            <Grid.Item col={1} alignItems="stretch" direction="column" />
            {dias.map((d) => (
              <Grid.Item key={d.fecha} col={1} alignItems="stretch" direction="column">
                <Box
                  padding={1}
                  background={d.fecha === fechaHoy ? 'primary100' : 'neutral0'}
                  textAlign="center"
                >
                  <Typography variant="sigma" textColor={d.fecha === fechaHoy ? 'primary600' : 'neutral600'}>
                    {d.etiqueta} {Number(d.fecha.slice(8, 10))}
                  </Typography>
                </Box>
              </Grid.Item>
            ))}

            <Grid.Item col={1} alignItems="stretch" direction="column">
              <EjeHoras rango={rango} />
            </Grid.Item>
            {dias.map((d) => (
              <Grid.Item key={d.fecha} col={1} alignItems="stretch" direction="column">
                <ColumnaDia
                  dia={(col.dias ?? []).find((x) => x.fecha === d.fecha)}
                  citas={(col.citas ?? []).filter((c) => String(c.startAt).slice(0, 10) === d.fecha)}
                  rango={rango}
                  esHoy={d.fecha === fechaHoy}
                  onAbrirCita={onAbrirCita}
                />
              </Grid.Item>
            ))}
          </Grid.Root>
        </Box>
      ))}
    </Flex>
  );
}
