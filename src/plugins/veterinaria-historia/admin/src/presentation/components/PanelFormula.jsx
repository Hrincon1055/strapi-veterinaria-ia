import * as React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth, useForm } from '@strapi/strapi/admin';
import {
  Badge, Box, Button, Checkbox, Field, Flex, LinkButton, Loader, Modal, Textarea, Typography,
} from '@strapi/design-system';
import { File } from '@strapi/icons';
import { useFormulasDeConsulta } from '../../application/useFormula';
import { ESTADO_FORMULA, fechaHora, numero, pautaFormula } from '../../domain/formato';
import { RUTA } from './comunes';

const CONSULTA = 'api::clinical.consultation';
const EMITIR = 'plugin::veterinaria-historia.formula.emitir';
const PERFIL = '/content-manager/collection-types/api::identity.profile';

const rutaFormula = (id) => `${RUTA}/formula/${id}`;

function ModalEmitir({ abierto, medicamentos, enviando, onCerrar, onEmitir }) {
  const [elegidos, setElegidos] = React.useState(() => new Set(medicamentos.map((m) => m.id)));
  React.useEffect(() => {
    if (abierto) setElegidos(new Set(medicamentos.map((m) => m.id)));
  }, [abierto, medicamentos]);

  const alternar = (id, v) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <Modal.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Emitir fórmula médica</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={3}>
            <Typography variant="pi" textColor="neutral600">
              Marca lo que va en la receta. Lo que se aplicó en la clínica no hace falta formularlo. La fórmula guarda una copia: si
              después cambias el plan, hay que anularla y emitir otra.
            </Typography>
            {medicamentos.map((m) => (
              <Box key={m.id} padding={3} hasRadius borderColor="neutral200">
                <Checkbox checked={elegidos.has(m.id)} onCheckedChange={(v) => alternar(m.id, Boolean(v))}>
                  <Typography fontWeight="bold">{m.medicamento}</Typography>
                </Checkbox>
                <Box paddingLeft={6}>
                  {m.producto && <Typography variant="pi" textColor="neutral600" tag="p">{m.producto.nombre}</Typography>}
                  <Typography variant="pi" tag="p">
                    {[pautaFormula(m), m.cantidad != null && `dispensar ${numero(m.cantidad)}`].filter(Boolean).join(' · ') || 'Sin pauta'}
                  </Typography>
                  {m.cantidad == null && (
                    <Typography variant="pi" textColor="warning700" tag="p">Sin cantidad a dispensar.</Typography>
                  )}
                  {m.controlado && (
                    <Typography variant="pi" textColor="danger700" tag="p">
                      De control especial: además hace falta el recetario oficial del FNE.
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cancelar</Button>
          </Modal.Close>
          <Button loading={enviando} disabled={elegidos.size === 0} onClick={() => onEmitir([...elegidos])}>
            Emitir ({elegidos.size})
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

function ModalAnular({ formula, enviando, onCerrar, onAnular }) {
  const [motivo, setMotivo] = React.useState('');
  React.useEffect(() => setMotivo(''), [formula]);

  return (
    <Modal.Root open={Boolean(formula)} onOpenChange={(v) => !v && onCerrar()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Anular la fórmula {formula?.numero}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Field.Root name="motivo" required hint="Queda registrado en la fórmula y sale al imprimirla.">
            <Field.Label>Motivo</Field.Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={255} />
            <Field.Hint />
          </Field.Root>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cancelar</Button>
          </Modal.Close>
          <Button variant="danger" loading={enviando} disabled={!motivo.trim()} onClick={() => onAnular(formula.documentId, motivo)}>
            Anular
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

function Formulas({ documentId }) {
  const { datos, cargando, error, sinPermiso, enviando, emitir, anular } = useFormulasDeConsulta(documentId);
  // La fórmula sale de lo guardado: con cambios sin guardar se imprimiría
  // otra cosa de lo que se ve en pantalla.
  const modificado = useForm('PanelFormula', (s) => s.modified);
  const navigate = useNavigate();
  const [emitiendo, setEmitiendo] = React.useState(false);
  const [anulando, setAnulando] = React.useState(null);

  if (cargando && !datos) return <Loader small>Cargando…</Loader>;
  if (sinPermiso) return <Typography variant="pi" textColor="neutral600">Sin permiso para emitir fórmulas.</Typography>;
  if (error || !datos) return <Typography variant="pi" textColor="danger600">{error ?? 'No se pudieron cargar las fórmulas.'}</Typography>;

  const { medicamentos, formulas, falta, firmante } = datos;

  return (
    <Flex direction="column" gap={3} alignItems="stretch" width="100%">
      {formulas.length === 0 ? (
        <Typography variant="pi" textColor="neutral600">Esta consulta no tiene fórmulas.</Typography>
      ) : (
        formulas.map((f) => {
          const e = ESTADO_FORMULA[f.estado];
          return (
            <Flex key={f.documentId} direction="column" alignItems="stretch" gap={1}>
              <Flex justifyContent="space-between" alignItems="center" gap={2}>
                <Typography variant="omega" fontWeight="bold">{f.numero}</Typography>
                <Badge backgroundColor={`${e.color}100`} textColor={`${e.color}700`}>{e.rotulo}</Badge>
              </Flex>
              <Typography variant="pi" textColor="neutral600">
                {fechaHora(f.emitidaEl)} · {f.firmante} · {f.medicamentos} {f.medicamentos === 1 ? 'medicamento' : 'medicamentos'}
              </Typography>
              <Flex gap={2}>
                <LinkButton tag={RouterLink} to={rutaFormula(f.documentId)} variant="tertiary" size="S" startIcon={<File />}>
                  {f.estado === 'voided' ? 'Ver' : 'Reimprimir'}
                </LinkButton>
                {f.estado === 'issued' && (
                  <Button variant="danger-light" size="S" disabled={enviando} onClick={() => setAnulando(f)}>
                    Anular
                  </Button>
                )}
              </Flex>
            </Flex>
          );
        })
      )}

      {falta ? (
        <Flex direction="column" alignItems="stretch" gap={2}>
          <Typography variant="pi" textColor="warning700">{falta}</Typography>
          {firmante.perfil && (
            <LinkButton tag={RouterLink} to={`${PERFIL}/${firmante.perfil}`} variant="secondary" size="S" fullWidth>
              Abrir mi perfil
            </LinkButton>
          )}
        </Flex>
      ) : medicamentos.length === 0 ? (
        <Typography variant="pi" textColor="neutral600">
          Para emitir una fórmula, añade un "Plan de tratamiento" con su medicación y guarda la consulta.
        </Typography>
      ) : (
        <>
          {modificado && <Typography variant="pi" textColor="warning700">Guarda la consulta antes de emitir.</Typography>}
          <Button variant="secondary" size="S" fullWidth disabled={modificado || enviando} onClick={() => setEmitiendo(true)}>
            Emitir fórmula
          </Button>
          <Typography variant="pi" textColor="neutral600">
            Firma {firmante.nombre} · T.P. {firmante.tarjeta}
            {firmante.conFirma ? '' : ' (sin firma escaneada: se firma a mano)'}
          </Typography>
        </>
      )}

      <ModalEmitir
        abierto={emitiendo}
        medicamentos={medicamentos}
        enviando={enviando}
        onCerrar={() => setEmitiendo(false)}
        onEmitir={async (ids) => {
          const f = await emitir(ids);
          if (f) {
            setEmitiendo(false);
            navigate(rutaFormula(f.documentId));
          }
        }}
      />
      <ModalAnular
        formula={anulando}
        enviando={enviando}
        onCerrar={() => setAnulando(null)}
        onAnular={async (id, motivo) => {
          if (await anular(id, motivo)) setAnulando(null);
        }}
      />
    </Flex>
  );
}

/**
 * Panel lateral de la consulta en el Content Manager: fórmulas emitidas
 * (reimprimir, anular) y "Emitir fórmula" con los medicamentos del plan de
 * tratamiento.
 *
 * Strapi pinta cada panel como un componente (`DescriptionComponentRenderer`),
 * así que aquí se pueden usar hooks: sin el permiso `formula.emitir` el panel
 * no aparece, en vez de ocupar sitio en la ficha de Recepción.
 */
export const PanelFormula = ({ model, documentId }) => {
  const permisos = useAuth('PanelFormula', (s) => s.permissions);
  if (model !== CONSULTA || !(permisos ?? []).some((p) => p.action === EMITIR)) return null;
  return {
    title: 'Fórmula médica',
    content: documentId ? (
      <Formulas documentId={documentId} />
    ) : (
      <Typography variant="pi" textColor="neutral600">Guarda la consulta para poder emitir la fórmula médica.</Typography>
    ),
  };
};
