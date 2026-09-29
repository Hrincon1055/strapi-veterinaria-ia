import {
  Box,
  Button,
  Combobox,
  ComboboxOption,
  Divider,
  Field,
  Flex,
  Modal,
  Textarea,
  Typography,
} from "@strapi/design-system";
import * as React from "react";
import { horaDe } from "../../domain/semana";

// Debe coincidir con el controlador: una letra suelta no explica la consulta.
const MOTIVO_MINIMO = 5;

const Dato = ({ etiqueta, valor }) => (
  <Flex justifyContent='space-between' gap={4}>
    <Typography variant='pi' textColor='neutral600'>
      {etiqueta}
    </Typography>
    <Typography variant='pi' fontWeight='bold'>
      {valor ?? "—"}
    </Typography>
  </Flex>
);

/**
 * Reservar en un hueco libre.
 *
 * Del hueco no se pregunta nada: profesional, día, hora y duración ya están
 * decididos por dónde se pulsó, y se muestran como datos, no como campos. Lo
 * único que falta es de quién es la cita. Eso mantiene la reserva en dos
 * gestos: pulsar el hueco y elegir la mascota.
 *
 * La búsqueda de mascota va contra el servidor y no filtra una lista traída
 * entera: una clínica con miles de pacientes no cabe en un desplegable, y el
 * `searchLabel` ya permite encontrar por mascota o por dueño.
 */
export function ModalNuevaCita({
  hueco,
  abierto,
  onCerrar,
  onBuscarMascotas,
  onReservar,
}) {
  const [mascotas, setMascotas] = React.useState([]);
  const [mascota, setMascota] = React.useState(null);
  const [motivo, setMotivo] = React.useState("");
  const [buscando, setBuscando] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);

  // Al abrir en otro hueco se limpia todo: si no, la mascota elegida antes
  // quedaría preseleccionada y se agendaría a quien no era.
  React.useEffect(() => {
    if (!abierto) return;
    setMascota(null);
    setMotivo("");
    setMascotas([]);
  }, [abierto, hueco?.startAt]);

  const buscar = React.useCallback(
    async (texto) => {
      setBuscando(true);
      try {
        setMascotas(await onBuscarMascotas(texto));
      } finally {
        setBuscando(false);
      }
    },
    [onBuscarMascotas],
  );

  // Primera carga al abrir: enseña algo antes de que se escriba nada.
  React.useEffect(() => {
    if (abierto) buscar("");
  }, [abierto, buscar]);

  // La búsqueda espera a que se deje de teclear: un `keyup` por letra
  // dispararía una consulta por letra.
  const alTeclear = (e) => {
    const texto = e.target.value;
    clearTimeout(alTeclear.temporizador);
    alTeclear.temporizador = setTimeout(() => buscar(texto), 250);
  };

  // El motivo es el título de la cita: sin él, la agenda y la consulta
  // que se abra desde ella quedan sin rótulo.
  const largoMotivo = motivo.trim().length;
  const motivoValido = largoMotivo >= MOTIVO_MINIMO;
  const completo = Boolean(mascota) && motivoValido;

  const confirmar = async () => {
    if (!completo) return;
    setGuardando(true);
    const ok = await onReservar({
      staff: hueco.staffDocumentId,
      mascota,
      startAt: hueco.startAt,
      motivo: motivo.trim(),
    });
    setGuardando(false);
    if (ok) onCerrar();
  };

  if (!hueco) return null;

  return (
    <Modal.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Reservar cita</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Flex direction='column' gap={4} alignItems='stretch'>
            <Box>
              <Dato etiqueta='Profesional' valor={hueco.staffNombre} />
              <Dato etiqueta='Día' valor={String(hueco.startAt).slice(0, 10)} />
              <Dato
                etiqueta='Hora'
                valor={`${horaDe(hueco.startAt)} – ${horaDe(hueco.endAt)} (${hueco.minutos} min)`}
              />
              <Dato etiqueta='Consultorio' valor={hueco.consultorio} />
            </Box>

            <Divider />

            <Field.Root name='mascota' required>
              <Field.Label>Mascota</Field.Label>
              <Combobox
                placeholder='Busca por mascota o por dueño…'
                value={mascota}
                onChange={setMascota}
                onInputChange={alTeclear}
                loading={buscando}
                loadingMessage='Buscando…'
                noOptionsMessage={() => "Ninguna mascota coincide"}>
                {mascotas.map((m) => (
                  <ComboboxOption key={m.documentId} value={m.documentId}>
                    {[m.nombre, m.especie, m.propietario]
                      .filter(Boolean)
                      .join(" · ")}
                  </ComboboxOption>
                ))}
              </Combobox>
              <Field.Hint />
            </Field.Root>

            <Field.Root
              name='motivo'
              required
              hint={`Mínimo ${MOTIVO_MINIMO} caracteres`}
              error={
                largoMotivo > 0 && !motivoValido
                  ? `Faltan ${MOTIVO_MINIMO - largoMotivo} caracteres`
                  : undefined
              }>
              <Field.Label>Motivo de la consulta</Field.Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder='Control anual, vacunación, revisión por cojera…'
              />
              <Field.Hint />
              <Field.Error />
            </Field.Root>
          </Flex>
        </Modal.Body>

        <Modal.Footer>
          <Flex gap={2}>
            <Button variant='tertiary' onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              disabled={!completo}
              loading={guardando}>
              Reservar
            </Button>
          </Flex>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
