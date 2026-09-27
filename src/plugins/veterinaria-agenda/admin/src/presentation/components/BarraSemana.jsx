import * as React from 'react';
import { Box, Flex, Typography, Button, IconButton, Tabs, Checkbox } from '@strapi/design-system';
import { ChevronLeft, ChevronRight } from '@strapi/icons';
import { rotuloSemana } from '../../domain/semana';
import { useAgendaStore } from '../store';

/**
 * Navegación de semana, cambio de vista y selector de personal.
 *
 * El selector solo aparece en la vista general: en la personal no hay nada
 * que elegir, y mostrarlo sugeriría que sí.
 */
export function BarraSemana({ yo, personal }) {
  const { lunes, vista, seleccion, semanaAnterior, semanaSiguiente, semanaActual, setVista, alternarStaff } =
    useAgendaStore();

  const puedeVerTodas = Boolean(yo?.puedeVerTodas);

  return (
    <Flex direction="column" gap={3} alignItems="stretch">
      <Flex justifyContent="space-between" alignItems="center" wrap="wrap" gap={3}>
        <Flex gap={2} alignItems="center">
          <IconButton label="Semana anterior" onClick={semanaAnterior}><ChevronLeft /></IconButton>
          <Box minWidth="16rem" textAlign="center">
            <Typography variant="beta">{rotuloSemana(lunes)}</Typography>
          </Box>
          <IconButton label="Semana siguiente" onClick={semanaSiguiente}><ChevronRight /></IconButton>
          <Button variant="tertiary" onClick={semanaActual}>Hoy</Button>
        </Flex>

        {puedeVerTodas && (
          <Tabs.Root value={vista} onValueChange={setVista}>
            <Tabs.List aria-label="Vista de la agenda">
              <Tabs.Trigger value="personal" disabled={!yo?.staffDocumentId}>Mi agenda</Tabs.Trigger>
              <Tabs.Trigger value="general">Todo el personal</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        )}
      </Flex>

      {puedeVerTodas && vista === 'general' && (
        <Flex gap={4} wrap="wrap" paddingTop={1}>
          {personal.map((s) => (
            <Checkbox
              key={s.documentId}
              checked={seleccion.includes(s.documentId)}
              onCheckedChange={() => alternarStaff(s.documentId)}
            >
              {s.nombre}
            </Checkbox>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
