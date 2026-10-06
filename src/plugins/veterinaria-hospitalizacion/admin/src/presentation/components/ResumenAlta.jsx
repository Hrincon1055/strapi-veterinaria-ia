import * as React from 'react';
import { Box, Flex, Typography, Divider, Table, Thead, Tbody, Tr, Th, Td } from '@strapi/design-system';
import { TIPO_ALTA, VIA, dias, fechaCorta } from '../../domain/formato';

/**
 * Resumen de alta para el propietario: lo que se imprime al dar el alta.
 * Solo lo que el dueño necesita (y lo mismo que ve en el portal): no lleva la
 * hoja de evolución interna.
 */
function Bloque({ titulo, children }) {
  if (!children) return null;
  return (
    <Box paddingTop={4} className="vho-sin-corte">
      <Typography variant="delta" tag="h3">{titulo}</Typography>
      <Box paddingTop={2}>
        <Typography style={{ whiteSpace: 'pre-line' }}>{children}</Typography>
      </Box>
    </Box>
  );
}

export function ResumenAlta({ hoja }) {
  const h = hoja.hospitalizacion;
  const alta = h.alta;
  return (
    <Box padding={2} background="neutral0">
      <Flex justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="alpha" tag="h1">Resumen de alta</Typography>
          <Typography textColor="neutral600">{TIPO_ALTA[alta.tipo] ?? alta.tipo}</Typography>
        </Box>
        {hoja.clinica && (
          <Box style={{ textAlign: 'right' }}>
            <Typography variant="delta" tag="p">{hoja.clinica.nombre}</Typography>
            {hoja.clinica.telefono && <Typography variant="pi" tag="p">Tel. {hoja.clinica.telefono}</Typography>}
            {hoja.clinica.urgencias && <Typography variant="pi" tag="p">Urgencias: {hoja.clinica.urgencias}</Typography>}
          </Box>
        )}
      </Flex>
      <Box paddingTop={4} paddingBottom={4}><Divider /></Box>

      <Flex gap={8} wrap="wrap" alignItems="flex-start">
        <Box>
          <Typography variant="sigma" textColor="neutral600">Paciente</Typography>
          <Typography tag="p" fontWeight="bold">{hoja.mascota?.nombre}</Typography>
          <Typography variant="pi" tag="p">{[hoja.mascota?.especie, hoja.mascota?.raza].filter(Boolean).join(' · ')}</Typography>
        </Box>
        <Box>
          <Typography variant="sigma" textColor="neutral600">Propietario</Typography>
          <Typography tag="p">{hoja.propietario?.nombre ?? '—'}</Typography>
        </Box>
        <Box>
          <Typography variant="sigma" textColor="neutral600">Estancia</Typography>
          <Typography tag="p">{h.ingresoTexto} → {alta.fechaTexto}</Typography>
          <Typography variant="pi" tag="p">{dias(h.dias)}</Typography>
        </Box>
        <Box>
          <Typography variant="sigma" textColor="neutral600">Veterinario responsable</Typography>
          <Typography tag="p">{h.veterinario ?? '—'}</Typography>
        </Box>
      </Flex>

      <Bloque titulo="Motivo del ingreso">{h.motivo}</Bloque>
      <Bloque titulo="Resumen de la hospitalización">{alta.resumen}</Bloque>
      <Bloque titulo="Indicaciones para casa">{alta.indicaciones}</Bloque>

      {alta.medicacion.length > 0 && (
        <Box paddingTop={4} className="vho-sin-corte">
          <Typography variant="delta" tag="h3">Medicación</Typography>
          <Box paddingTop={2}>
            <Table colCount={5} rowCount={alta.medicacion.length + 1}>
              <Thead>
                <Tr>{['Medicamento', 'Dosis', 'Vía', 'Frecuencia', 'Duración'].map((c) => <Th key={c}><Typography variant="sigma">{c}</Typography></Th>)}</Tr>
              </Thead>
              <Tbody>
                {alta.medicacion.map((m, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Tr key={i}>
                    <Td><Typography fontWeight="bold">{m.drug}</Typography>{m.notes && <Typography variant="pi" tag="p">{m.notes}</Typography>}</Td>
                    <Td><Typography>{m.dose ?? '—'}</Typography></Td>
                    <Td><Typography>{VIA[m.route] ?? m.route}</Typography></Td>
                    <Td><Typography>{m.frequencyHours ? `cada ${m.frequencyHours} h` : '—'}</Typography></Td>
                    <Td><Typography>{m.durationDays ? `${m.durationDays} días` : '—'}</Typography></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      )}

      {alta.control && (
        <Box paddingTop={4}>
          <Typography variant="delta" tag="h3">Próximo control: {fechaCorta(alta.control)}</Typography>
        </Box>
      )}

      <Box paddingTop={10}>
        <Flex gap={10}>
          <Box style={{ flex: 1, borderTop: '1px solid #8e8ea9', paddingTop: 4 }}>
            <Typography variant="pi">{alta.por ?? h.veterinario ?? 'Veterinario'}</Typography>
          </Box>
          <Box style={{ flex: 1, borderTop: '1px solid #8e8ea9', paddingTop: 4 }}>
            <Typography variant="pi">Recibí conforme (propietario)</Typography>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}
