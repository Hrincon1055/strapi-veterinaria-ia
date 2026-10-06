import * as React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@strapi/strapi/admin';
import { Flex, LinkButton, Typography, Loader } from '@strapi/design-system';
import { useApi } from '../../application/useHospitalizacion';
import { TIPO_ALTA, dias } from '../../domain/formato';
import { Dato, RUTA, rutaHoja } from './comunes';

const MASCOTA = 'api::pet.pet';
const CONSULTA = 'api::clinical.consultation';
const PREFIJO = 'plugin::veterinaria-hospitalizacion.hospitalizacion.';

function Resumen({ model, documentId }) {
  const { api } = useApi();
  const permisos = useAuth('PanelHospitalizacion', (s) => s.permissions);
  const puede = (a) => (permisos ?? []).some((p) => p.action === `${PREFIJO}${a}`);
  const veo = ['ver', 'registrar', 'prescribir'].some(puede);
  const [estado, setEstado] = React.useState({ cargando: true });

  React.useEffect(() => {
    if (!veo) return undefined;
    let vivo = true;
    const pedir = model === MASCOTA ? api.deMascota(documentId) : api.deConsulta(documentId);
    pedir.then((datos) => vivo && setEstado({ datos })).catch(() => vivo && setEstado({ error: true }));
    return () => { vivo = false; };
  }, [api, model, documentId, veo]);

  if (!veo) return <Typography variant="pi" textColor="neutral600">Sin acceso a hospitalización.</Typography>;
  if (estado.cargando) return <Loader small>Cargando…</Loader>;
  if (estado.error || !estado.datos) return <Typography variant="pi" textColor="neutral600">No se pudo consultar la hospitalización.</Typography>;

  const { activa, anteriores } = estado.datos;
  return (
    <Flex direction="column" gap={2} alignItems="stretch" width="100%">
      {activa ? (
        <>
          <Dato etiqueta="Ingresada en">{activa.jaula ?? '—'}</Dato>
          <Dato etiqueta="Desde">{activa.ingresoTexto}</Dato>
          <Dato etiqueta="Estancia">{dias(activa.dias)}</Dato>
          <LinkButton tag={RouterLink} to={rutaHoja(activa.documentId)} variant="secondary" size="S" fullWidth>Abrir la hoja</LinkButton>
        </>
      ) : (
        <>
          <Typography variant="pi" textColor="neutral600">No está hospitalizada.</Typography>
          {puede('prescribir') && (
            <LinkButton tag={RouterLink} to={RUTA} variant="secondary" size="S" fullWidth>Ir a hospitalización</LinkButton>
          )}
        </>
      )}
      {anteriores.map((h) => (
        <Dato key={h.documentId} etiqueta={h.ingresoTexto}>
          <RouterLink to={rutaHoja(h.documentId)}>{TIPO_ALTA[h.tipo]?.split(' ').slice(0, 2).join(' ') ?? 'Alta'}</RouterLink>
        </Dato>
      ))}
    </Flex>
  );
}

/**
 * Panel lateral de la ficha de la mascota y de la consulta en el Content
 * Manager (`addEditViewSidePanel`): si está hospitalizada, dónde y desde
 * cuándo, con el atajo a la hoja; si no, el camino al ingreso. Solo en
 * documentos ya guardados.
 */
export const PanelHospitalizacion = ({ model, documentId }) => {
  if ((model !== MASCOTA && model !== CONSULTA) || !documentId) return null;
  return {
    title: 'Hospitalización',
    content: <Resumen model={model} documentId={documentId} />,
  };
};
