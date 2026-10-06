import * as React from 'react';
import { Box, Divider, Flex, Typography } from '@strapi/design-system';
import { fecha, fechaHora, numero, edad, SEXO, cantidadEnLetras, pautaFormula, urlArchivo } from '../../domain/formato';

/**
 * La fórmula médica como documento: lo mismo en la vista previa que en papel
 * A5 (ver `Impresion.jsx`). Pinta la COPIA guardada al emitir, no el plan de
 * tratamiento actual: una reimpresión sale idéntica a la que se entregó.
 *
 * Una fórmula anulada se sigue pudiendo ver e imprimir (para archivo), pero
 * con la marca "ANULADA" cruzada encima.
 */

const unir = (...partes) => partes.filter(Boolean).join(' · ');

const Tenue = ({ children }) => <Typography variant="pi" textColor="neutral600">{children}</Typography>;

function Dato({ etiqueta, children }) {
  return (
    <Flex direction="column" alignItems="flex-start" gap={0}>
      <Typography variant="sigma" textColor="neutral600">{etiqueta}</Typography>
      <Typography variant="omega">{children ?? '—'}</Typography>
    </Flex>
  );
}

function Datos({ children }) {
  return (
    <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px 12px' }}>{children}</Box>
  );
}

function Encabezado({ clinica, f }) {
  return (
    <Flex justifyContent="space-between" alignItems="flex-start" gap={4}>
      <Flex gap={3} alignItems="center">
        {clinica?.logo && (
          <img src={urlArchivo(clinica.logo.url)} alt="" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
        )}
        {clinica && (
          <Flex direction="column" alignItems="flex-start" gap={0}>
            <Typography variant="delta" tag="p">{clinica.nombre}</Typography>
            <Tenue>{unir(clinica.razonSocial !== clinica.nombre && clinica.razonSocial, clinica.documento)}</Tenue>
            <Tenue>{unir(clinica.direccion, clinica.telefono)}</Tenue>
          </Flex>
        )}
      </Flex>
      <Flex direction="column" alignItems="flex-end" gap={0}>
        <Typography variant="beta" tag="h1">Fórmula médica</Typography>
        <Typography variant="omega" fontWeight="bold">{f.numero}</Typography>
        <Tenue>{fechaHora(f.emitidaEl)}</Tenue>
      </Flex>
    </Flex>
  );
}

function Medicamento({ m, n }) {
  const letras = m.cantidad != null ? cantidadEnLetras(m.cantidad) : null;
  return (
    <Box className="vh-sin-corte" paddingBottom={3}>
      <Typography variant="omega" fontWeight="bold">
        {n}. {m.medicamento}
      </Typography>
      {(m.presentacion || m.principiosActivos) && (
        <Box paddingLeft={4}>
          <Tenue>{unir(m.presentacion !== m.medicamento && m.presentacion, m.principiosActivos)}</Tenue>
        </Box>
      )}
      <Box paddingLeft={4}>
        {pautaFormula(m) && <Typography variant="omega">{pautaFormula(m)}</Typography>}
        {m.cantidad != null && (
          <Typography variant="omega" tag="p">
            Cantidad a dispensar: <strong>{numero(m.cantidad)}</strong>
            {letras && ` (${letras})`}
          </Typography>
        )}
        {m.notas && <Tenue>{m.notas}</Tenue>}
        {m.controlado && (
          <Typography variant="pi" textColor="danger700" tag="p">
            Medicamento de control especial: requiere además el recetario oficial del Fondo Nacional de Estupefacientes.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function FormulaDocumento({ f }) {
  const { clinica, propietario: p, mascota: m, firmante } = f;
  const anulada = f.estado === 'voided';
  const e = m ? edad(m.nacimiento, new Date(f.emitidaEl)) : null;

  return (
    <Box position="relative" style={{ overflow: 'hidden' }}>
      {anulada && (
        <Box
          aria-hidden
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 1,
          }}
        >
          <Typography
            variant="alpha"
            textColor="danger600"
            style={{ fontSize: 72, opacity: 0.18, transform: 'rotate(-30deg)', letterSpacing: 8 }}
          >
            ANULADA
          </Typography>
        </Box>
      )}

      <Flex direction="column" alignItems="stretch" gap={3}>
        <Encabezado clinica={clinica} f={f} />
        <Divider />

        <Datos>
          <Dato etiqueta="Propietario">{p?.nombre}</Dato>
          <Dato etiqueta="Documento">{p?.documento}</Dato>
          <Dato etiqueta="Teléfono">{p?.telefono}</Dato>
        </Datos>
        {m && (
          <Datos>
            <Dato etiqueta="Paciente">{m.nombre}</Dato>
            <Dato etiqueta="Especie / raza">{unir(m.especie, m.raza)}</Dato>
            <Dato etiqueta="Sexo · edad · peso">
              {unir(SEXO(m.sexo), e, m.pesoKg != null && `${numero(m.pesoKg)} kg`) || null}
            </Dato>
          </Datos>
        )}
        <Divider />

        <Typography variant="beta" tag="p">Rp/</Typography>
        <Box>
          {f.medicamentos.map((x, i) => (
            <Medicamento key={i} m={x} n={i + 1} />
          ))}
        </Box>

        {(f.instrucciones || f.proximoControl) && (
          <Box className="vh-sin-corte">
            <Typography variant="sigma" textColor="neutral600">Indicaciones</Typography>
            {f.instrucciones && (
              <Typography variant="omega" tag="p" style={{ whiteSpace: 'pre-line' }}>{f.instrucciones}</Typography>
            )}
            {f.proximoControl && <Typography variant="omega" tag="p">Próximo control: {fecha(f.proximoControl)}</Typography>}
          </Box>
        )}

        <Flex justifyContent="flex-end" paddingTop={4} className="vh-sin-corte">
          <Flex direction="column" alignItems="center" gap={1} style={{ minWidth: 220 }}>
            {firmante.firma ? (
              <img src={urlArchivo(firmante.firma.url)} alt="Firma" style={{ maxHeight: 56, maxWidth: 200, objectFit: 'contain' }} />
            ) : (
              <Box style={{ height: 48 }} />
            )}
            <Box style={{ borderTop: '1px solid currentColor', width: '100%' }} />
            <Typography variant="omega" fontWeight="bold">{firmante.nombre}</Typography>
            <Tenue>
              T.P. {firmante.tarjeta}
              {firmante.entidad ? ` · ${firmante.entidad}` : ''}
            </Tenue>
          </Flex>
        </Flex>

        {anulada && (
          <Typography variant="pi" textColor="danger700">
            Anulada el {fechaHora(f.anuladaEl)}: {f.motivoAnulacion}
          </Typography>
        )}
      </Flex>
    </Box>
  );
}
