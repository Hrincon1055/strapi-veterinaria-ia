import * as React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import styled from 'styled-components';
import { Page, Layouts } from '@strapi/strapi/admin';
import {
  Box, Flex, Typography, Button, Table, Thead, Tbody, Tr, Th, Td, Checkbox, Link, Alert, Badge,
} from '@strapi/design-system';
import { Plus, WarningCircle } from '@strapi/icons';
import { useHospitalizacionStore } from '../store';
import { usePermisos, useTablero, useIngreso, useBusquedas } from '../../application/useHospitalizacion';
import { TAMANO, TIPO_JAULA, TIPO_ALTA, dias } from '../../domain/formato';
import { Insignia, Tarjeta, Estado, rutaHoja } from '../components/comunes';
import { ModalIngreso } from '../components/modales';

/**
 * Tablero de la sala: cada jaula, libre u ocupada, con el paciente, los días
 * de estancia y las tomas atrasadas. Se refresca solo cada minuto.
 */

const Rejilla = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: ${({ theme }) => theme.spaces[4]};
`;

/** Una jaula: borde de color según su estado; ocupada lleva al paciente. */
const Jaula = styled.button`
  all: unset;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spaces[2]};
  min-height: 150px;
  padding: ${({ theme }) => theme.spaces[4]};
  border-radius: ${({ theme }) => theme.borderRadius};
  background: ${({ theme, $estado }) => ($estado === 'libre' ? theme.colors.neutral100 : theme.colors.neutral0)};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-left: 6px solid ${({ theme, $estado }) =>
    $estado === 'atrasada' ? theme.colors.danger600
      : $estado === 'ocupada' ? theme.colors.primary600
        : $estado === 'inactiva' ? theme.colors.neutral300
          : theme.colors.success500};
  opacity: ${({ $estado }) => ($estado === 'inactiva' ? 0.6 : 1)};
  cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
  box-shadow: ${({ theme }) => theme.shadows.tableShadow};
  &:hover:not(:disabled) { border-color: ${({ theme }) => theme.colors.primary600}; }
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary600}; outline-offset: 2px; }
`;

function TarjetaJaula({ jaula, puedePrescribir, onAbrir, onIngresar }) {
  const p = jaula.paciente;
  const estado = !jaula.activa ? 'inactiva' : !p ? 'libre' : p.atrasadas > 0 ? 'atrasada' : 'ocupada';
  const accion = p ? () => onAbrir(p.documentId) : jaula.activa && puedePrescribir ? () => onIngresar(jaula.documentId) : null;
  return (
    <Jaula type="button" $estado={estado} disabled={!accion} onClick={accion ?? undefined}
      aria-label={p ? `${jaula.nombre}: ${p.mascota?.nombre}` : `${jaula.nombre}: ${estado}`}>
      <Flex justifyContent="space-between" gap={2}>
        <Typography variant="omega" fontWeight="bold">{jaula.nombre}</Typography>
        <Insignia estado={jaula.tipo} mapa={TIPO_JAULA} />
      </Flex>
      {p ? (
        <>
          <Box>
            <Typography variant="delta" tag="p">{p.mascota?.nombre ?? '—'}</Typography>
            <Typography variant="pi" textColor="neutral600">
              {[p.mascota?.especie, p.mascota?.raza, p.propietario].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <Typography variant="pi" textColor="neutral700" ellipsis>{p.motivo}</Typography>
          <Flex gap={2} wrap="wrap">
            <Badge>{dias(p.dias)}</Badge>
            {p.atrasadas > 0 && <Badge backgroundColor="danger100" textColor="danger700">{p.atrasadas} atrasada(s)</Badge>}
            {p.proximas > 0 && <Badge backgroundColor="warning100" textColor="warning700">{p.proximas} próxima(s)</Badge>}
            {p.alergias.length > 0 && <Badge backgroundColor="danger100" textColor="danger700">Alergias</Badge>}
          </Flex>
          {p.veterinario && <Typography variant="pi" textColor="neutral600">Responsable: {p.veterinario}</Typography>}
        </>
      ) : (
        <Flex direction="column" alignItems="flex-start" gap={1} grow={1} justifyContent="center">
          <Typography textColor="neutral600">{jaula.activa ? 'Libre' : 'Desactivada'}</Typography>
          <Typography variant="pi" textColor="neutral500">{TAMANO[jaula.tamano] ?? jaula.tamano}{jaula.servicioDiario ? ` · ${jaula.servicioDiario}` : ''}</Typography>
          {jaula.activa && puedePrescribir && <Typography variant="pi" textColor="primary600">Ingresar aquí</Typography>}
        </Flex>
      )}
    </Jaula>
  );
}

export function TableroPage() {
  const navigate = useNavigate();
  const permisos = usePermisos();
  const { soloActivas, setSoloActivas } = useHospitalizacionStore();
  const { datos, cargando, error } = useTablero();
  const busquedas = useBusquedas();
  const ingreso = useIngreso();
  const [ingresoEn, setIngresoEn] = React.useState(undefined); // undefined: cerrado; null: sin jaula elegida

  const deshabilitada = permisos && permisos.habilitada === false;
  const r = datos?.resumen;

  return (
    <Page.Main>
      <Page.Title>Hospitalización</Page.Title>
      <Layouts.Header
        title="Hospitalización"
        subtitle={r ? `${r.ingresados} ingresado(s) · ${r.libres} jaula(s) libre(s)${r.atrasadas ? ` · ${r.atrasadas} toma(s) atrasada(s)` : ''}` : 'Pacientes ingresados, jaulas y tomas'}
        primaryAction={permisos?.puedePrescribir && !deshabilitada && (
          <Button startIcon={<Plus />} onClick={() => setIngresoEn(null)}>Ingresar paciente</Button>
        )}
      />
      <Layouts.Content>
        {deshabilitada ? (
          <Alert variant="default" title="La clínica no tiene hospitalización activada">
            Para usar este módulo, la administración debe marcar "Hospitaliza pacientes" en Clínica y crear las jaulas
            (en una sala de tipo hospitalización), cada una con su servicio por día.
          </Alert>
        ) : (
          <Estado cargando={cargando} error={error}>
            <Flex direction="column" gap={6} alignItems="stretch">
              {r?.atrasadas > 0 && (
                <Alert variant="danger" title="Tomas atrasadas" icon={<WarningCircle />}>
                  Hay {r.atrasadas} toma(s) programada(s) hace más de una hora sin registrar.
                </Alert>
              )}
              <Flex justifyContent="flex-end">
                <Checkbox checked={!soloActivas} onCheckedChange={(v) => setSoloActivas(!v)}>Mostrar jaulas desactivadas</Checkbox>
              </Flex>
              {(datos?.salas ?? []).length === 0 && (
                <Tarjeta>
                  <Typography textColor="neutral600">
                    No hay jaulas. La administración las crea en el Content Manager (Jaula), dentro de una sala de tipo
                    "hospitalization".
                  </Typography>
                </Tarjeta>
              )}
              {(datos?.salas ?? []).map((sala) => {
                const jaulas = sala.jaulas.filter((j) => !soloActivas || j.activa || j.paciente);
                if (jaulas.length === 0) return null;
                return (
                  <Tarjeta key={sala.documentId ?? 'sin-sala'} titulo={sala.nombre}
                    subtitulo={`${jaulas.filter((j) => j.paciente).length} de ${jaulas.length} ocupadas`}>
                    <Rejilla>
                      {jaulas.map((j) => (
                        <TarjetaJaula key={j.documentId} jaula={j} puedePrescribir={permisos?.puedePrescribir}
                          onAbrir={(id) => navigate(rutaHoja(id))} onIngresar={(id) => setIngresoEn(id)} />
                      ))}
                    </Rejilla>
                  </Tarjeta>
                );
              })}

              <Tarjeta titulo="Altas de los últimos 7 días">
                {(datos?.altasRecientes ?? []).length === 0 ? (
                  <Typography textColor="neutral600">Ninguna.</Typography>
                ) : (
                  <Table colCount={4} rowCount={datos.altasRecientes.length + 1}>
                    <Thead>
                      <Tr>{['Mascota', 'Jaula', 'Alta', 'Tipo'].map((c) => <Th key={c}><Typography variant="sigma">{c}</Typography></Th>)}</Tr>
                    </Thead>
                    <Tbody>
                      {datos.altasRecientes.map((a) => (
                        <Tr key={a.documentId}>
                          <Td><Link tag={RouterLink} to={rutaHoja(a.documentId)}>{a.mascota ?? '—'}</Link></Td>
                          <Td><Typography>{a.jaula ?? '—'}</Typography></Td>
                          <Td><Typography>{a.altaTexto}</Typography></Td>
                          <Td><Typography>{TIPO_ALTA[a.tipo] ?? a.tipo}</Typography></Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
              </Tarjeta>
            </Flex>
          </Estado>
        )}
      </Layouts.Content>

      <ModalIngreso
        abierto={ingresoEn !== undefined}
        jaulaInicial={ingresoEn ?? ''}
        onCerrar={() => setIngresoEn(undefined)}
        busquedas={busquedas}
        ocupado={ingreso.ocupado}
        onIngresar={async (d) => {
          const id = await ingreso.ingresar(d);
          if (id) navigate(rutaHoja(id));
        }}
      />
    </Page.Main>
  );
}
