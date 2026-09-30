import * as React from 'react';
import { Badge, Button, Flex, Loader, Typography } from '@strapi/design-system';
import { useAtencion } from '../../application/useAtencion';
import { COLOR_ESTADO, ETIQUETA_ESTADO, horaDe } from '../../domain/semana';

const CONSULTA = 'api::clinical.consultation';
const CERRADAS = ['completed', 'cancelled', 'no_show'];

function Atencion({ documentId }) {
  const { cargando, sinPermiso, error, datos, enviando, finalizar, reabrir } = useAtencion(documentId);

  if (cargando) return <Loader small>Cargando…</Loader>;
  if (sinPermiso) return <Typography variant="pi" textColor="neutral600">Sin acceso a la agenda.</Typography>;
  if (error || !datos) return <Typography variant="pi" textColor="danger600">No se pudo consultar la cita.</Typography>;

  const { cita, puedeFinalizar } = datos;
  if (!cita) {
    return (
      <Typography variant="pi" textColor="neutral600">
        Esta consulta no viene de una cita de la agenda.
      </Typography>
    );
  }

  const color = COLOR_ESTADO[cita.state] ?? 'neutral';
  return (
    <Flex direction="column" gap={3} alignItems="stretch" width="100%">
      <Flex justifyContent="space-between" alignItems="center">
        <Typography variant="pi" textColor="neutral600">
          {String(cita.startAt).slice(0, 10)} · {horaDe(cita.startAt)} – {horaDe(cita.endAt)}
        </Typography>
        <Badge backgroundColor={`${color}100`} textColor={`${color}700`}>{ETIQUETA_ESTADO[cita.state]}</Badge>
      </Flex>

      {!puedeFinalizar ? (
        !CERRADAS.includes(cita.state) && (
          <Typography variant="pi" textColor="neutral600">
            La finaliza quien atiende al terminar la consulta.
          </Typography>
        )
      ) : cita.state === 'completed' ? (
        <Button variant="tertiary" size="S" fullWidth loading={enviando} onClick={reabrir}>
          Reabrir atención
        </Button>
      ) : CERRADAS.includes(cita.state) ? null : (
        <>
          <Button variant="success" size="S" fullWidth loading={enviando} onClick={finalizar}>
            Finalizar atención
          </Button>
          <Typography variant="pi" textColor="neutral600">
            Guarda la consulta antes: finalizar no guarda el formulario. La historia se puede seguir
            editando después.
          </Typography>
        </>
      )}
    </Flex>
  );
}

/**
 * Panel lateral de la ficha de la consulta (`addEditViewSidePanel`): el
 * estado de su cita y el botón para darla por atendida.
 *
 * Guardar la consulta NO cierra la cita, a propósito: el veterinario guarda
 * varias veces durante la visita (anamnesis, examen, resultado de
 * laboratorio), y cerrarla en el primer guardado liberaría su tramo en la
 * agenda con el paciente todavía en el consultorio. Cerrar es una decisión
 * explícita de quien atiende; el cierre nocturno
 * (`src/bootstrap/cierre-citas.ts`) recoge las que se queden abiertas.
 */
export const PanelAtencion = ({ model, documentId }) => {
  if (model !== CONSULTA || !documentId) return null;
  return {
    title: 'Atención',
    content: <Atencion documentId={documentId} />,
  };
};
