import * as React from 'react';
import {
  Badge, Button, Field, Flex, Loader, SingleSelect, SingleSelectOption, Typography,
} from '@strapi/design-system';
import { useForm } from '@strapi/strapi/admin';
import { useAtencion } from '../../application/useAtencion';
import { COLOR_ESTADO, ETIQUETA_ESTADO, horaDe } from '../../domain/semana';

const CONSULTA = 'api::clinical.consultation';
const CERRADAS = ['completed', 'cancelled', 'no_show'];

/**
 * La consulta no tiene servicio aplicado: se propone el de Clínica y el
 * veterinario confirma o cambia qué servicio fue la visita. Si se cobra no
 * lo decide él: lo decide Facturación al preparar la factura.
 */
function ElegirCargo({ servicios, porDefecto, enviando, bloqueado, onFinalizar }) {
  const [elegido, setElegido] = React.useState(porDefecto?.documentId ?? '');
  React.useEffect(() => {
    if (!elegido && porDefecto) setElegido(porDefecto.documentId);
  }, [porDefecto, elegido]);

  return (
    <Flex direction="column" gap={2} alignItems="stretch">
      <Typography variant="pi" textColor="warning700">
        Esta consulta no tiene servicio registrado. ¿Qué servicio fue la visita?
      </Typography>
      <Field.Root name="cargo-consulta">
        <SingleSelect
          size="S"
          placeholder={servicios ? 'Elige un servicio' : 'Cargando servicios…'}
          value={elegido}
          onChange={(v) => setElegido(String(v))}
          disabled={!servicios || bloqueado}
        >
          {(servicios ?? []).map((s) => (
            <SingleSelectOption key={s.documentId} value={s.documentId}>{s.nombre}</SingleSelectOption>
          ))}
        </SingleSelect>
      </Field.Root>
      <Button
        variant="success"
        size="S"
        fullWidth
        loading={enviando}
        disabled={!elegido || bloqueado}
        onClick={() => onFinalizar({ servicio: elegido })}
      >
        Añadir y finalizar
      </Button>
      <Typography variant="pi" textColor="neutral600">
        Si se cobra o no lo decide Facturación antes de emitir la factura.
      </Typography>
      {!porDefecto && (
        <Typography variant="pi" textColor="neutral600">
          Clínica no tiene "Servicio de consulta por defecto": la administración puede elegirlo para que salga
          ya seleccionado.
        </Typography>
      )}
    </Flex>
  );
}

function Atencion({ documentId }) {
  const { cargando, sinPermiso, error, datos, enviando, servicios, hayQueElegir, finalizar, reabrir } =
    useAtencion(documentId);
  // Con cambios sin guardar no se finaliza: finalizar puede escribir en la
  // consulta y recargar la ficha, y esos cambios se perderían.
  const modificado = useForm('PanelAtencion', (s) => s.modified);

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
  const abierta = !CERRADAS.includes(cita.state);

  return (
    <Flex direction="column" gap={3} alignItems="stretch" width="100%">
      <Flex justifyContent="space-between" alignItems="center">
        <Typography variant="pi" textColor="neutral600">
          {String(cita.startAt).slice(0, 10)} · {horaDe(cita.startAt)} – {horaDe(cita.endAt)}
        </Typography>
        <Badge backgroundColor={`${color}100`} textColor={`${color}700`}>{ETIQUETA_ESTADO[cita.state]}</Badge>
      </Flex>

      {!puedeFinalizar ? (
        abierta && (
          <Typography variant="pi" textColor="neutral600">
            La finaliza quien atiende al terminar la consulta.
          </Typography>
        )
      ) : cita.state === 'completed' ? (
        <Button variant="tertiary" size="S" fullWidth loading={enviando} onClick={reabrir}>
          Reabrir atención
        </Button>
      ) : !abierta ? null : (
        <>
          {modificado && (
            <Typography variant="pi" textColor="warning700">
              Guarda la consulta antes de finalizar.
            </Typography>
          )}
          {hayQueElegir ? (
            <ElegirCargo
              servicios={servicios}
              porDefecto={datos.servicioPorDefecto}
              enviando={enviando}
              bloqueado={modificado}
              onFinalizar={finalizar}
            />
          ) : (
            <Button variant="success" size="S" fullWidth loading={enviando} disabled={modificado} onClick={() => finalizar()}>
              Finalizar atención
            </Button>
          )}
          <Typography variant="pi" textColor="neutral600">
            La historia se puede seguir editando después de finalizar.
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
 *
 * Y al cerrar se asegura que la visita llegue a Facturación: si la consulta no
 * tiene ningún servicio aplicado, se propone el "Servicio de consulta por
 * defecto" de Clínica.
 */
export const PanelAtencion = ({ model, documentId }) => {
  if (model !== CONSULTA || !documentId) return null;
  return {
    title: 'Atención',
    content: <Atencion documentId={documentId} />,
  };
};
