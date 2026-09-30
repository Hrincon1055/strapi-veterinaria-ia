import * as React from 'react';
import {
  Badge, Button, Field, Flex, Loader, SingleSelect, SingleSelectOption, Typography,
} from '@strapi/design-system';
import { useForm } from '@strapi/strapi/admin';
import { useAtencion } from '../../application/useAtencion';
import { COLOR_ESTADO, ETIQUETA_ESTADO, horaDe } from '../../domain/semana';

const CONSULTA = 'api::clinical.consultation';

function Atencion({ documentId }) {
  const { cargando, sinPermiso, error, datos, enviando, servicios, finalizar, guardarServicio, reabrir } =
    useAtencion(documentId);
  // Con cambios sin guardar no se actúa: el servidor puede escribir en la
  // consulta y la ficha se recarga, y esos cambios se perderían.
  const modificado = useForm('PanelAtencion', (s) => s.modified);

  // Propuesto: el servicio que ya tiene la visita (el de la reserva) y, si no
  // tiene, el "Servicio de consulta por defecto" de Clínica.
  const actual = datos?.servicioVisita?.documentId ?? '';
  const propuesto = actual || datos?.servicioPorDefecto?.documentId || '';
  const [elegido, setElegido] = React.useState('');
  React.useEffect(() => setElegido(propuesto), [propuesto]);

  if (cargando) return <Loader small>Cargando…</Loader>;
  if (sinPermiso) return <Typography variant="pi" textColor="neutral600">Sin acceso a la agenda.</Typography>;
  if (error || !datos) return <Typography variant="pi" textColor="danger600">No se pudo consultar la atención.</Typography>;

  const { cita, puedeFinalizar, tieneCargo, servicioVisita } = datos;
  const anulada = Boolean(cita && ['cancelled', 'no_show'].includes(cita.state));
  // Atendida: cita cerrada, o consulta sin cita que ya tiene su servicio.
  const atendida = cita ? cita.state === 'completed' : tieneCargo;
  const estado = cita ? cita.state : atendida ? 'completed' : null;
  const color = estado ? COLOR_ESTADO[estado] ?? 'neutral' : 'neutral';

  return (
    <Flex direction="column" gap={3} alignItems="stretch" width="100%">
      <Flex justifyContent="space-between" alignItems="center" gap={2}>
        <Typography variant="pi" textColor="neutral600">
          {cita
            ? `${String(cita.startAt).slice(0, 10)} · ${horaDe(cita.startAt)} – ${horaDe(cita.endAt)}`
            : 'Consulta sin cita de agenda'}
        </Typography>
        {estado && (
          <Badge backgroundColor={`${color}100`} textColor={`${color}700`}>{ETIQUETA_ESTADO[estado]}</Badge>
        )}
      </Flex>

      {!puedeFinalizar ? (
        <>
          <Typography variant="pi">
            Servicio de la visita: <b>{servicioVisita?.nombre ?? '—'}</b>
          </Typography>
          {cita && !atendida && !anulada && (
            <Typography variant="pi" textColor="neutral600">La finaliza quien atiende al terminar la consulta.</Typography>
          )}
        </>
      ) : anulada ? null : (
        <>
          <Field.Root name="servicio-visita" hint="Si se cobra o no lo decide Facturación.">
            <Field.Label>Servicio de la visita</Field.Label>
            <SingleSelect
              size="S"
              placeholder={servicios ? 'Elige un servicio' : 'Cargando servicios…'}
              value={elegido}
              onChange={(v) => setElegido(String(v))}
              disabled={!servicios || enviando}
            >
              {(servicios ?? []).map((s) => (
                <SingleSelectOption key={s.documentId} value={s.documentId}>{s.nombre}</SingleSelectOption>
              ))}
            </SingleSelect>
            <Field.Hint />
          </Field.Root>

          {modificado && (
            <Typography variant="pi" textColor="warning700">Guarda la consulta antes de continuar.</Typography>
          )}

          {!atendida ? (
            <Button
              variant="success"
              size="S"
              fullWidth
              loading={enviando}
              disabled={!elegido || modificado}
              onClick={() => finalizar(elegido)}
            >
              Finalizar atención
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="S"
              fullWidth
              loading={enviando}
              disabled={!elegido || elegido === actual || modificado}
              onClick={() => guardarServicio(elegido)}
            >
              Guardar servicio
            </Button>
          )}

          {cita?.state === 'completed' && (
            <Button variant="tertiary" size="S" fullWidth disabled={enviando} onClick={reabrir}>
              Reabrir atención
            </Button>
          )}

          {!datos.servicioPorDefecto && !actual && (
            <Typography variant="pi" textColor="neutral600">
              Clínica no tiene "Servicio de consulta por defecto": la administración puede elegirlo para que salga
              ya seleccionado.
            </Typography>
          )}
        </>
      )}
    </Flex>
  );
}

/**
 * Panel lateral de la ficha de la consulta (`addEditViewSidePanel`): el
 * servicio de la visita y el cierre de la atención. Sale siempre en las
 * consultas, vengan o no de una cita.
 *
 * El servicio de la visita se ve siempre y se puede corregir: si viene de la
 * reserva, la recepcionista pudo equivocarse; si la consulta no tiene cita
 * (urgencia, atención no prevista), se propone el de Clínica.
 *
 * Guardar la consulta NO cierra la cita, a propósito: el veterinario guarda
 * varias veces durante la visita (anamnesis, examen, resultado de
 * laboratorio), y cerrarla en el primer guardado liberaría su tramo en la
 * agenda con el paciente todavía en el consultorio. Cerrar es una decisión
 * explícita de quien atiende; el cierre nocturno
 * (`src/bootstrap/cierre-citas.ts`) recoge las que se queden abiertas.
 */
export const PanelAtencion = ({ model, documentId }) => {
  if (model !== CONSULTA) return null;
  return {
    title: 'Atención',
    // Una consulta nueva no existe hasta que se guarda: no hay dónde
    // registrar el servicio todavía.
    content: documentId ? (
      <Atencion documentId={documentId} />
    ) : (
      <Typography variant="pi" textColor="neutral600">
        Guarda la consulta para elegir el servicio de la visita y finalizar la atención.
      </Typography>
    ),
  };
};
