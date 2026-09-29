import * as React from 'react';
import { Modal, Button, Flex, Typography, Badge, Divider, Box } from '@strapi/design-system';
import { COLOR_ESTADO, ETIQUETA_ESTADO, horaDe } from '../../domain/semana';

const Dato = ({ etiqueta, valor }) => (
  <Flex justifyContent="space-between" gap={4}>
    <Typography variant="pi" textColor="neutral600">{etiqueta}</Typography>
    <Typography variant="pi" fontWeight="bold">{valor ?? '—'}</Typography>
  </Flex>
);

/**
 * Qué hacer con una cita.
 *
 * "Atender" es la acción principal: crea la consulta con mascota, veterinario
 * y fecha ya puestos, y lleva al formulario. Si la cita ya tiene consulta, el
 * botón abre esa en vez de crear otra — por eso el texto cambia.
 */
export function ModalCita({ cita, abierto, onCerrar, onCambiarEstado, onAtender, onFacturar }) {
  if (!cita) return null;

  const tieneConsulta = Boolean(cita.consultationDocumentId);
  const cerrada = ['completed', 'cancelled', 'no_show'].includes(cita.state);

  return (
    <Modal.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{cita.mascota?.nombre ?? 'Cita'}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Flex direction="column" gap={3} alignItems="stretch">
            <Flex justifyContent="space-between" alignItems="center">
              <Typography variant="omega">
                {String(cita.startAt).slice(0, 10)} · {horaDe(cita.startAt)} – {horaDe(cita.endAt)}
              </Typography>
              <Badge backgroundColor={`${COLOR_ESTADO[cita.state]}100`} textColor={`${COLOR_ESTADO[cita.state]}700`}>
                {ETIQUETA_ESTADO[cita.state]}
              </Badge>
            </Flex>

            <Divider />

            <Dato etiqueta="Propietario" valor={cita.propietario} />
            <Dato etiqueta="Consultorio" valor={cita.consultorio} />
            <Dato etiqueta="Motivo" valor={cita.title} />

            {cerrada && (
              <Box paddingTop={2}>
                <Typography variant="pi" textColor="neutral600">
                  Esta cita ya está cerrada. Cambia su estado si necesitas reabrirla.
                </Typography>
              </Box>
            )}
          </Flex>
        </Modal.Body>

        <Modal.Footer>
          <Flex gap={2} wrap="wrap">
            <Button variant="tertiary" onClick={() => onCambiarEstado(cita.documentId, 'arrived')}>
              Llegó
            </Button>
            <Button variant="danger-light" onClick={() => onCambiarEstado(cita.documentId, 'no_show')}>
              No asistió
            </Button>
            <Button variant="secondary" onClick={() => onCambiarEstado(cita.documentId, 'completed')}>
              Marcar atendida
            </Button>
            {tieneConsulta && onFacturar && (
              <Button variant="secondary" onClick={() => onFacturar(cita.consultationDocumentId)}>
                Facturar
              </Button>
            )}
            <Button onClick={() => onAtender(cita.documentId)}>
              {tieneConsulta ? 'Abrir consulta' : 'Atender y crear consulta'}
            </Button>
          </Flex>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
