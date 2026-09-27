import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Layouts } from '@strapi/strapi/admin';
import { Box, Flex, Typography, Alert, Loader, EmptyStateLayout } from '@strapi/design-system';
import { useAgenda } from '../application/useAgenda';
import { BarraSemana } from './components/BarraSemana';
import { RejillaSemana } from './components/RejillaSemana';
import { ModalCita } from './components/ModalCita';

export function AgendaPage() {
  const navigate = useNavigate();
  const { yo, personal, semana, cargando, error, seleccion, cambiarEstado, abrirConsulta } = useAgenda();
  const [citaAbierta, setCitaAbierta] = React.useState(null);

  const atender = async (documentId) => {
    const ruta = await abrirConsulta(documentId);
    setCitaAbierta(null);
    // La consulta ya trae mascota, veterinario y fecha: el formulario se abre
    // listo para escribir la historia, no en blanco.
    if (ruta) navigate(ruta);
  };

  return (
    <Page.Main>
      <Layouts.Header
        title="Agenda"
        subtitle="Calendario semanal del personal, huecos libres y citas"
      />

      <Layouts.Content>
        <Flex direction="column" gap={4} alignItems="stretch">
          {yo && !yo.staffDocumentId && (
            <Alert variant="warning" title="Tu cuenta no está enlazada a un perfil de personal">
              Para ver tu agenda personal, abre Content Manager → Profile, busca tu perfil y
              rellena el campo <strong>adminUser</strong> con tu cuenta de administrador.
            </Alert>
          )}

          {error && <Alert variant="danger" title="No se pudo cargar la agenda">{error}</Alert>}

          <BarraSemana yo={yo} personal={personal} />

          {cargando && (
            <Flex justifyContent="center" padding={8}><Loader>Cargando la agenda…</Loader></Flex>
          )}

          {!cargando && seleccion.length === 0 && (
            <EmptyStateLayout
              content="Selecciona al menos una persona para ver su agenda."
              hasRadius
            />
          )}

          {!cargando && semana && semana.columnas.length > 0 && (
            <RejillaSemana semana={semana} onAbrirCita={setCitaAbierta} />
          )}

          {!cargando && semana && semana.columnas.length === 0 && seleccion.length > 0 && (
            <EmptyStateLayout
              content="Nadie del personal seleccionado tiene horario activo en esta semana."
              hasRadius
            />
          )}

          <Box paddingTop={2}>
            <Typography variant="pi" textColor="neutral500">
              Los huecos libres se calculan al vuelo cruzando horario, ausencias y citas.
              No son registros: no existen hasta que se reservan.
            </Typography>
          </Box>
        </Flex>
      </Layouts.Content>

      <ModalCita
        cita={citaAbierta}
        abierto={Boolean(citaAbierta)}
        onCerrar={() => setCitaAbierta(null)}
        onCambiarEstado={(id, estado) => { cambiarEstado(id, estado); setCitaAbierta(null); }}
        onAtender={atender}
      />
    </Page.Main>
  );
}
