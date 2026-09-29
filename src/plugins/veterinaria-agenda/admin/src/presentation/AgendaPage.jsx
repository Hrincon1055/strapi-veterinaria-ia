import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Layouts, useAuth } from '@strapi/strapi/admin';
import { Box, Flex, Typography, Alert, Loader, EmptyStateLayout } from '@strapi/design-system';
import { useAgenda } from '../application/useAgenda';
import { BarraSemana } from './components/BarraSemana';
import { RejillaSemana } from './components/RejillaSemana';
import { ModalCita } from './components/ModalCita';
import { ModalNuevaCita } from './components/ModalNuevaCita';

export function AgendaPage() {
  const navigate = useNavigate();
  const {
    yo, personal, semana, cargando, error, seleccion,
    cambiarEstado, abrirConsulta, buscarMascotas, reservar,
  } = useAgenda();
  const [citaAbierta, setCitaAbierta] = React.useState(null);
  const [huecoElegido, setHuecoElegido] = React.useState(null);

  // Quien no puede reservar no recibe el handler, y sin él los huecos se
  // pintan como fondo inerte. El servidor lo comprueba igual: esto solo evita
  // ofrecer un botón que iba a dar 403.
  const puedeAgendar = Boolean(yo?.puedeAgendar);

  // Facturar es del plugin de facturación: el botón solo sale a quien tenga
  // alguno de sus permisos (sus rutas lo comprueban igual).
  const permisos = useAuth('AgendaPage', (s) => s.permissions);
  const puedeFacturar = (permisos ?? []).some((p) => String(p.action).startsWith('plugin::veterinaria-facturacion.'));

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
            <Alert variant="warning" title="Tu cuenta no tiene horario de atención">
              Para ver tu agenda personal, crea tu horario en Content Manager → Horario de
              atención y elige tu cuenta en el campo <strong>Profesional</strong>.
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
            <RejillaSemana
              semana={semana}
              onAbrirCita={setCitaAbierta}
              onAgendar={puedeAgendar ? setHuecoElegido : undefined}
            />
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
              {puedeAgendar
                ? ' Pulsa un hueco para reservar una cita en él.'
                : ' Tu cuenta puede consultar y atender la agenda, pero no reservar citas.'}
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
        onFacturar={puedeFacturar
          ? (consultaId) => navigate(`/plugins/veterinaria-facturacion/consultas/${consultaId}`)
          : undefined}
      />

      <ModalNuevaCita
        hueco={huecoElegido}
        abierto={Boolean(huecoElegido)}
        onCerrar={() => setHuecoElegido(null)}
        onBuscarMascotas={buscarMascotas}
        onReservar={reservar}
      />
    </Page.Main>
  );
}
