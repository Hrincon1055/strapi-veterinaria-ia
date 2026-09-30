import * as React from 'react';
import { Box, Flex, Typography, Divider } from '@strapi/design-system';
import { fechasDeSemana, hoy, minutosAhora, rangoVisible } from '../../domain/semana';
import { ColumnaDia, PX_POR_MINUTO } from './ColumnaDia';

/** Grosor del marco del día actual; el mismo en la cabecera y en la columna. */
const MARCO_HOY = '2px';

/**
 * El reloj de la rejilla. Se repinta cada minuto para que la línea de "ahora"
 * avance y, a medianoche, el marco pase al día siguiente sin recargar.
 */
function useAhora() {
  const [ahora, setAhora] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

/**
 * Columnas de la rejilla: la de horas mide lo que su texto y los siete días se
 * reparten el resto. `minmax(0, 1fr)` y no `1fr`: con `1fr` una tarjeta de
 * texto largo ensancharía su día y descuadraría la semana.
 */
const COLUMNAS = 'max-content repeat(7, minmax(0, 1fr))';

/**
 * Eje de horas a la izquierda, una marca por hora.
 *
 * Las marcas van en posición absoluta y no dan ancho a la columna; lo da un
 * "00:00" invisible en el flujo, que mide exactamente lo que una hora.
 */
function EjeHoras({ rango, ahora }) {
  const horas = [];
  for (let m = rango.min; m <= rango.max; m += 60) horas.push(m);
  const dos = (n) => String(n).padStart(2, '0');

  return (
    <Box position="relative" paddingRight={2} style={{ height: `${(rango.max - rango.min) * PX_POR_MINUTO}px` }}>
      <Box aria-hidden style={{ visibility: 'hidden', height: 0, overflow: 'hidden' }}>
        <Typography variant="pi">00:00</Typography>
      </Box>
      {horas.map((m) => (
        <Box key={m} position="absolute" style={{ top: `${(m - rango.min) * PX_POR_MINUTO - 8}px`, right: '8px' }}>
          <Typography variant="pi" textColor="neutral500">
            {String(Math.floor(m / 60)).padStart(2, '0')}:00
          </Typography>
        </Box>
      ))}
      {/* La hora exacta junto a la línea de "ahora", tapando la marca de hora
          que tenga debajo. Solo si la semana visible contiene hoy. */}
      {ahora != null && (
        <Box
          position="absolute"
          background="primary600"
          hasRadius
          paddingLeft={1}
          paddingRight={1}
          style={{ top: `${(ahora - rango.min) * PX_POR_MINUTO - 9}px`, right: '4px', zIndex: 3 }}
        >
          <Typography variant="pi" fontWeight="bold" textColor="neutral0">
            {dos(Math.floor(ahora / 60))}:{dos(ahora % 60)}
          </Typography>
        </Box>
      )}
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
 *
 * `onAgendar` llega sin definir cuando la cuenta no puede reservar, y eso
 * basta para que los huecos se pinten inertes: la decisión se toma una vez,
 * arriba, y no se repite en cada componente.
 */
export function RejillaSemana({ semana, onAbrirCita, onAgendar }) {
  const dias = fechasDeSemana(semana.lunes);
  const rango = rangoVisible(semana.columnas);
  const reloj = useAhora();
  const fechaHoy = hoy(reloj);
  // La línea de "ahora" solo tiene sentido si hoy está en esta semana y la
  // hora cae dentro de la franja pintada; fuera de ella no se dibuja.
  const minuto = minutosAhora(reloj);
  const ahora =
    dias.some((d) => d.fecha === fechaHoy) && minuto >= rango.min && minuto <= rango.max ? minuto : null;

  return (
    <Flex direction="column" gap={6} alignItems="stretch">
      {semana.columnas.map((col) => {
        // El hueco no sabe de quién es: se le añade la columna aquí, que es
        // donde se conoce. Sin esto habría que adivinar el profesional al
        // reservar. Si no se puede agendar queda `undefined`, y con eso solo
        // el hueco ya se pinta inerte.
        const agendarEnEstaColumna = onAgendar
          ? (h) =>
              onAgendar({
                ...h,
                staffDocumentId: col.staff.documentId,
                staffNombre: col.staff.nombre,
                consultorio: col.staff.consultorio,
              })
          : undefined;

        return (
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

          <Box paddingTop={2} style={{ display: 'grid', gridTemplateColumns: COLUMNAS }}>
            <Box />
            {/* El día actual lleva un marco que empieza en la cabecera y
                baja por toda la columna: son dos celdas de la rejilla, así
                que cada una pone su parte del borde. */}
            {dias.map((d) => {
              const esHoy = d.fecha === fechaHoy;
              return (
                <Box
                  key={d.fecha}
                  padding={1}
                  background={esHoy ? 'primary600' : 'neutral0'}
                  textAlign="center"
                  borderColor={esHoy ? 'primary600' : undefined}
                  borderStyle={esHoy ? 'solid' : undefined}
                  borderWidth={esHoy ? `${MARCO_HOY} ${MARCO_HOY} 0 ${MARCO_HOY}` : undefined}
                  style={esHoy ? { borderRadius: '4px 4px 0 0' } : undefined}
                  aria-current={esHoy ? 'date' : undefined}
                >
                  <Typography variant="sigma" textColor={esHoy ? 'neutral0' : 'neutral600'}>
                    {esHoy ? 'Hoy · ' : ''}{d.etiqueta} {Number(d.fecha.slice(8, 10))}
                  </Typography>
                </Box>
              );
            })}

            <EjeHoras rango={rango} ahora={ahora} />
            {dias.map((d) => {
              const esHoy = d.fecha === fechaHoy;
              return (
                <Box
                  key={d.fecha}
                  borderColor={esHoy ? 'primary600' : undefined}
                  borderStyle={esHoy ? 'solid' : undefined}
                  borderWidth={esHoy ? `0 ${MARCO_HOY} ${MARCO_HOY} ${MARCO_HOY}` : undefined}
                  style={esHoy ? { borderRadius: '0 0 4px 4px' } : undefined}
                >
                  <ColumnaDia
                    dia={(col.dias ?? []).find((x) => x.fecha === d.fecha)}
                    citas={(col.citas ?? []).filter((c) => String(c.startAt).slice(0, 10) === d.fecha)}
                    rango={rango}
                    esHoy={esHoy}
                    ahora={ahora}
                    onAbrirCita={onAbrirCita}
                    onAgendar={agendarEnEstaColumna}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>
        );
      })}
    </Flex>
  );
}
