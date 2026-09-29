import * as React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Flex, Typography, Loader, LinkButton } from '@strapi/design-system';
import { useApi } from '../../application/useFacturacion';
import { dinero, RESUMEN_CONSULTA } from '../../domain/formato';
import { Insignia, Dato, RUTA } from './comunes';

const CONSULTA = 'api::clinical.consultation';

function Resumen({ documentId }) {
  const { api } = useApi();
  const [estado, setEstado] = React.useState({ cargando: true });

  React.useEffect(() => {
    let vivo = true;
    api.estadoConsulta(documentId)
      .then((datos) => vivo && setEstado({ datos }))
      // Sin permiso de facturación (403) el panel no dice nada: no es un error
      // de la consulta.
      .catch((e) => vivo && setEstado({ sinPermiso: e?.response?.status === 403, error: true }));
    return () => { vivo = false; };
  }, [api, documentId]);

  if (estado.cargando) return <Loader small>Cargando…</Loader>;
  if (estado.sinPermiso) return <Typography variant="pi" textColor="neutral600">Sin acceso a facturación.</Typography>;
  if (estado.error || !estado.datos) return <Typography variant="pi" textColor="danger600">No se pudo consultar la facturación.</Typography>;

  const e = estado.datos;
  const facturas = [...new Map(e.lineas.filter((l) => l.factura).map((l) => [l.factura.documentId, l.factura])).values()];
  return (
    <Flex direction="column" gap={2} alignItems="stretch" width="100%">
      <Dato etiqueta="Estado"><Insignia estado={e.resumen} mapa={RESUMEN_CONSULTA} /></Dato>
      <Dato etiqueta="Pendientes">{e.pendientes}</Dato>
      {e.pendientes > 0 && <Dato etiqueta="Por cobrar (est.)">{dinero(e.valorPendiente)}</Dato>}
      {facturas.map((f) => (
        <Dato key={f.documentId} etiqueta="Factura">{f.fullNumber ?? 'Borrador'}</Dato>
      ))}
      <LinkButton tag={RouterLink} to={`${RUTA}/consultas/${documentId}`} variant="secondary" size="S" fullWidth>
        {e.pendientes > 0 ? 'Facturar' : 'Ver facturación'}
      </LinkButton>
    </Flex>
  );
}

/**
 * Panel lateral de la vista de edición del Content Manager
 * (`addEditViewSidePanel`). Strapi lo llama con `{ model, documentId, … }`
 * para cada documento abierto; devolver `null` lo oculta, así que solo sale
 * en las consultas ya guardadas.
 *
 * Mientras se edita, el resumen es el de lo guardado: una línea añadida sin
 * guardar aún no aparece.
 */
export const PanelConsulta = ({ model, documentId }) => {
  if (model !== CONSULTA || !documentId) return null;
  return {
    title: 'Facturación',
    content: <Resumen documentId={documentId} />,
  };
};
