import * as React from 'react';
import { Badge, Box, Divider, Flex, Typography, Table, Thead, Tbody, Tr, Th, Td } from '@strapi/design-system';
import { Bloques, tieneContenido } from './Bloques';
import {
  fecha, fechaHora, numero, edad, SEXO, ESTERILIZACION, CATEGORIA_ALERGIA, SEVERIDAD, REFERIDO_POR,
  PANEL_LAB, MODALIDAD, TIPO_DIAGNOSTICO, ANESTESIA, ESTADO_LINEA, TIPO_ADJUNTO, TITULO_SECCION,
  pauta, constantes, vacunaVencida, urlArchivo,
} from '../../domain/formato';

/**
 * La historia clínica como documento: lo mismo en la vista previa que en
 * papel (ver `Impresion.jsx`). Solo Design System; las clases `vh-*` son
 * marcas para las reglas de salto de página, no estilos.
 *
 * `opciones`: { lineas, adjuntos } — qué bloques opcionales se incluyen.
 */

// ---------------------------------------------------------------- piezas

function Dato({ etiqueta, children }) {
  return (
    <Flex direction="column" alignItems="flex-start" gap={1}>
      <Typography variant="sigma" textColor="neutral600">{etiqueta}</Typography>
      <Typography variant="omega">{children ?? '—'}</Typography>
    </Flex>
  );
}

/** Rejilla de datos de ancho fijo: no depende de los puntos de corte de pantalla. */
function Datos({ columnas = 4, children }) {
  return (
    <Box style={{ display: 'grid', gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`, gap: '12px 16px' }}>
      {children}
    </Box>
  );
}

function Titulo({ children, extra }) {
  return (
    <Flex direction="column" alignItems="stretch" gap={2} className="vh-con-siguiente">
      <Flex justifyContent="space-between" alignItems="baseline" gap={2}>
        <Typography variant="delta" tag="h3">{children}</Typography>
        {extra}
      </Flex>
      <Divider />
    </Flex>
  );
}

const Insignia = ({ color = 'neutral', children }) => (
  <Badge backgroundColor={`${color}100`} textColor={`${color}700`}>{children}</Badge>
);

const Tenue = ({ children }) => <Typography variant="pi" textColor="neutral600">{children}</Typography>;

/** "a · b · c" sin los vacíos. */
const unir = (...partes) => partes.filter(Boolean).join(' · ');

// ---------------------------------------------------------------- cabecera

function Encabezado({ clinica, generada, periodo }) {
  return (
    <Flex justifyContent="space-between" alignItems="flex-start" gap={6}>
      <Flex gap={4} alignItems="center">
        {clinica?.logo && (
          <img src={urlArchivo(clinica.logo.url)} alt="" style={{ maxHeight: 64, maxWidth: 160, objectFit: 'contain' }} />
        )}
        {clinica && (
          <Flex direction="column" alignItems="flex-start" gap={1}>
            <Typography variant="beta" tag="p">{clinica.nombre}</Typography>
            <Tenue>{unir(clinica.razonSocial !== clinica.nombre && clinica.razonSocial, clinica.documento)}</Tenue>
            <Tenue>{unir(clinica.direccion, clinica.telefono)}</Tenue>
            <Tenue>{unir(clinica.correo, clinica.web)}</Tenue>
          </Flex>
        )}
      </Flex>
      <Flex direction="column" alignItems="flex-end" gap={1}>
        <Typography variant="alpha" tag="h1">Historia clínica</Typography>
        <Tenue>Generada el {fechaHora(generada?.el)}{generada?.por ? ` por ${generada.por}` : ''}</Tenue>
        <Tenue>
          {periodo?.desde || periodo?.hasta
            ? `Periodo: ${periodo.desde ? fecha(periodo.desde) : 'inicio'} – ${periodo.hasta ? fecha(periodo.hasta) : 'hoy'}`
            : 'Historia completa'}
        </Tenue>
      </Flex>
    </Flex>
  );
}

function Propietario({ p }) {
  return (
    <Box className="vh-sin-corte">
      <Titulo>Propietario</Titulo>
      <Box paddingTop={3}>
        <Datos columnas={4}>
          <Dato etiqueta="Nombre">{p.nombre}</Dato>
          <Dato etiqueta="Documento">{p.documento}</Dato>
          <Dato etiqueta="Teléfono">{p.telefono}</Dato>
          <Dato etiqueta="Correo">{p.correo}</Dato>
        </Datos>
        {p.direccion && <Box paddingTop={3}><Dato etiqueta="Dirección">{p.direccion}</Dato></Box>}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------- mascota

function Ficha({ m, referencia }) {
  const e = edad(m.nacimiento, referencia);
  return (
    <Datos columnas={4}>
      <Dato etiqueta="Especie">{m.especie}</Dato>
      <Dato etiqueta="Raza">{m.raza}</Dato>
      <Dato etiqueta="Sexo">{SEXO(m.sexo)}</Dato>
      <Dato etiqueta="Color">{m.color}</Dato>
      <Dato etiqueta="Nacimiento">{m.nacimiento ? `${fecha(m.nacimiento)}${e ? ` (${e})` : ''}` : null}</Dato>
      <Dato etiqueta="Peso actual">{m.pesoKg != null ? `${numero(m.pesoKg)} kg` : null}</Dato>
      <Dato etiqueta="Esterilización">
        {m.esterilizacion ? `${ESTERILIZACION(m.esterilizacion)}${m.esterilizadaEl ? ` (${fecha(m.esterilizadaEl)})` : ''}` : null}
      </Dato>
      <Dato etiqueta="Microchip">{m.microchip}</Dato>
    </Datos>
  );
}

function Alergias({ alergias }) {
  if (alergias.length === 0) {
    return <Tenue>Sin alergias registradas.</Tenue>;
  }
  return (
    <Flex direction="column" alignItems="stretch" gap={2}>
      {alergias.map((a, i) => {
        const sev = SEVERIDAD[a.severidad];
        return (
          <Box
            key={i}
            className="vh-sin-corte"
            padding={3}
            hasRadius
            background={a.activa ? 'danger100' : 'neutral100'}
            borderColor={a.activa ? 'danger200' : 'neutral200'}
          >
            <Flex gap={2} wrap="wrap" alignItems="center">
              <Typography variant="omega" fontWeight="bold">{a.alergeno}</Typography>
              {sev && <Insignia color={a.activa ? sev.color : 'neutral'}>{sev.rotulo}</Insignia>}
              {a.categoria && <Insignia>{CATEGORIA_ALERGIA(a.categoria)}</Insignia>}
              <Insignia color={a.activa ? 'danger' : 'success'}>
                {a.activa ? 'Activa' : `Resuelta${a.resueltaEl ? ` ${fecha(a.resueltaEl)}` : ''}`}
              </Insignia>
              {a.diagnosticadaEl && <Tenue>Diagnosticada el {fecha(a.diagnosticadaEl)}</Tenue>}
            </Flex>
            {a.reaccion && <Box paddingTop={1}><Typography variant="pi">Reacción: {a.reaccion}</Typography></Box>}
            {a.notas && <Box paddingTop={1}><Tenue>{a.notas}</Tenue></Box>}
          </Box>
        );
      })}
    </Flex>
  );
}

function Vacunas({ vacunas }) {
  if (vacunas.length === 0) return <Tenue>Sin vacunas registradas en el periodo.</Tenue>;
  const columnas = ['Aplicada', 'Vacuna', 'Dosis', 'Lote', 'Próxima', 'Aplicó'];
  return (
    <Table colCount={columnas.length} rowCount={vacunas.length + 1}>
      <Thead>
        <Tr>{columnas.map((c) => <Th key={c}><Typography variant="sigma">{c}</Typography></Th>)}</Tr>
      </Thead>
      <Tbody>
        {vacunas.map((v, i) => (
          <Tr key={i}>
            <Td><Typography variant="pi">{fecha(v.aplicadaEl)}</Typography></Td>
            <Td>
              <Typography variant="pi" fontWeight="bold">{v.vacuna}</Typography>
              {v.laboratorio && <Typography variant="pi" textColor="neutral600"> · {v.laboratorio}</Typography>}
            </Td>
            <Td><Typography variant="pi">{v.dosis ?? '—'}</Typography></Td>
            <Td><Typography variant="pi">{v.lote ?? '—'}</Typography></Td>
            <Td>
              <Flex gap={2}>
                <Typography variant="pi">{fecha(v.proximaEl)}</Typography>
                {vacunaVencida(v) && <Insignia color="warning">Vencida</Insignia>}
              </Flex>
            </Td>
            <Td><Typography variant="pi">{v.veterinario ?? '—'}</Typography></Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

// ---------------------------------------------------------------- consulta

/** Nombre de un archivo adjunto; en pantalla, enlazado. */
const Archivo = ({ a }) =>
  a ? <a href={urlArchivo(a.url)} target="_blank" rel="noreferrer">{a.nombre}</a> : null;

function CuerpoSeccion({ s }) {
  switch (s.__component) {
    case 'clinical.anamnesis':
      return (
        <>
          {(s.reportedBy || s.evolutionDays != null) && (
            <Tenue>
              {unir(
                s.reportedBy && `Referido por ${REFERIDO_POR(s.reportedBy)}`,
                s.evolutionDays != null && `evolución de ${s.evolutionDays} ${s.evolutionDays === 1 ? 'día' : 'días'}`
              )}
            </Tenue>
          )}
          <Bloques valor={s.history} />
        </>
      );

    case 'clinical.physical-exam': {
      const c = constantes(s);
      return (
        <>
          {c.length > 0 && (
            <Datos columnas={4}>
              {c.map(([k, v]) => <Dato key={k} etiqueta={k}>{v}</Dato>)}
            </Datos>
          )}
          <Bloques valor={s.findings} />
        </>
      );
    }

    case 'clinical.lab-result':
      return (
        <>
          <Flex gap={2} wrap="wrap" alignItems="center">
            <Typography variant="omega" fontWeight="bold">{PANEL_LAB(s.panel)}</Typography>
            {s.isAbnormal && <Insignia color="danger">Alterado</Insignia>}
            <Tenue>{unir(s.laboratory, s.sampleTakenOn && `muestra del ${fecha(s.sampleTakenOn)}`)}</Tenue>
          </Flex>
          <Bloques valor={s.findings} />
          {s.report && <Tenue>Informe: <Archivo a={s.report} /></Tenue>}
        </>
      );

    case 'clinical.imaging':
      return (
        <>
          <Typography variant="omega" fontWeight="bold">{unir(MODALIDAD(s.modality), s.bodyRegion)}</Typography>
          <Bloques valor={s.findings} />
          {s.images?.length > 0 && (
            <Tenue>
              Imágenes:{' '}
              {s.images.map((a, i) => <React.Fragment key={i}>{i > 0 && ', '}<Archivo a={a} /></React.Fragment>)}
            </Tenue>
          )}
        </>
      );

    case 'clinical.diagnosis':
      return (
        <>
          <Flex gap={2} wrap="wrap" alignItems="center">
            <Typography variant="omega" fontWeight="bold">{s.condition}</Typography>
            <Insignia color={s.diagnosisKind === 'definitive' ? 'success' : s.diagnosisKind === 'ruled_out' ? 'neutral' : 'secondary'}>
              {TIPO_DIAGNOSTICO(s.diagnosisKind)}
            </Insignia>
            {s.isPrimary && <Insignia color="primary">Principal</Insignia>}
          </Flex>
          <Bloques valor={s.details} />
        </>
      );

    case 'clinical.procedure':
      return (
        <>
          <Flex gap={2} wrap="wrap" alignItems="baseline">
            <Typography variant="omega" fontWeight="bold">{s.procedureName}</Typography>
            <Tenue>{unir(ANESTESIA(s.anesthesia), s.durationMinutes && `${s.durationMinutes} min`)}</Tenue>
          </Flex>
          <Bloques valor={s.findings} />
          {s.complications && <Typography variant="pi">Complicaciones: {s.complications}</Typography>}
        </>
      );

    case 'clinical.treatment-plan':
      return (
        <>
          <Bloques valor={s.indications} />
          {s.medications?.length > 0 && (
            <Flex direction="column" alignItems="stretch" gap={1}>
              <Typography variant="sigma" textColor="neutral600">Medicación</Typography>
              {s.medications.map((m, i) => (
                <Typography key={i} variant="omega">
                  <strong>{m.drug}</strong>
                  {m.producto && m.producto !== m.drug && ` (${m.producto})`}
                  {pauta(m) && ` — ${pauta(m)}`}
                  {m.quantity != null && ` · dispensar ${numero(m.quantity)}`}
                  {m.notes && <Typography variant="pi" textColor="neutral600"> ({m.notes})</Typography>}
                </Typography>
              ))}
            </Flex>
          )}
          {tieneContenido(s.recommendations) && (
            <Flex direction="column" alignItems="stretch" gap={1}>
              <Typography variant="sigma" textColor="neutral600">Recomendaciones</Typography>
              <Bloques valor={s.recommendations} />
            </Flex>
          )}
          {s.followUpOn && <Typography variant="pi" fontWeight="bold">Control: {fecha(s.followUpOn)}</Typography>}
        </>
      );

    default:
      return null;
  }
}

function Seccion({ s }) {
  return (
    <Box className="vh-sin-corte" paddingLeft={3} borderColor="neutral200" borderStyle="solid" style={{ borderWidth: '0 0 0 3px' }}>
      <Flex direction="column" alignItems="stretch" gap={2}>
        <Typography variant="sigma" textColor="primary600">{TITULO_SECCION[s.__component] ?? s.__component}</Typography>
        <CuerpoSeccion s={s} />
      </Flex>
    </Box>
  );
}

function Lineas({ lineas }) {
  const columnas = ['Concepto', 'Tipo', 'Cantidad', 'Estado'];
  return (
    <Table colCount={columnas.length} rowCount={lineas.length + 1}>
      <Thead>
        <Tr>{columnas.map((c) => <Th key={c}><Typography variant="sigma">{c}</Typography></Th>)}</Tr>
      </Thead>
      <Tbody>
        {lineas.map((l, i) => (
          <Tr key={i}>
            <Td>
              <Flex direction="column" alignItems="flex-start">
                <Typography variant="pi" fontWeight="bold">{l.nombre}</Typography>
                {l.notas && <Typography variant="pi" textColor="neutral600">{l.notas}</Typography>}
              </Flex>
            </Td>
            <Td><Typography variant="pi">{l.tipo === 'servicio' ? 'Servicio' : 'Producto'}</Typography></Td>
            <Td><Typography variant="pi">{numero(l.cantidad)}</Typography></Td>
            <Td><Typography variant="pi">{ESTADO_LINEA(l.estado)}</Typography></Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

function Consulta({ c, opciones }) {
  const adjuntos = opciones.adjuntos ? c.adjuntos.filter((a) => a.archivo) : [];
  return (
    <Box padding={4} hasRadius borderColor="neutral200" borderStyle="solid" borderWidth="1px">
      <Flex direction="column" alignItems="stretch" gap={4}>
        <Flex direction="column" alignItems="stretch" gap={1} className="vh-con-siguiente">
          <Flex justifyContent="space-between" alignItems="baseline" gap={4} wrap="wrap">
            <Typography variant="epsilon" fontWeight="bold">{fechaHora(c.fecha)}</Typography>
            <Tenue>{unir(c.veterinario && `Atendió: ${c.veterinario}`, c.consultorio)}</Tenue>
          </Flex>
          <Typography variant="omega">
            <strong>Motivo:</strong> {c.motivo ?? c.titulo ?? '—'}
          </Typography>
          <Tenue>
            {unir(c.pesoKg != null && `Peso: ${numero(c.pesoKg)} kg`, c.proximoControl && `Próximo control: ${fecha(c.proximoControl)}`)}
          </Tenue>
        </Flex>

        {c.secciones.length === 0 ? (
          <Tenue>Sin anotaciones clínicas.</Tenue>
        ) : (
          c.secciones.map((s, i) => <Seccion key={i} s={s} />)
        )}

        {opciones.lineas && c.lineas.length > 0 && (
          <Flex direction="column" alignItems="stretch" gap={2} className="vh-sin-corte">
            <Typography variant="sigma" textColor="neutral600">Servicios y productos</Typography>
            <Lineas lineas={c.lineas} />
          </Flex>
        )}

        {adjuntos.length > 0 && (
          <Flex direction="column" alignItems="stretch" gap={1} className="vh-sin-corte">
            <Typography variant="sigma" textColor="neutral600">Adjuntos</Typography>
            {adjuntos.map((a, i) => (
              <Typography key={i} variant="pi">
                {TIPO_ADJUNTO(a.tipo)}: <Archivo a={a.archivo} />{a.descripcion ? ` — ${a.descripcion}` : ''}
              </Typography>
            ))}
          </Flex>
        )}
      </Flex>
    </Box>
  );
}

// ---------------------------------------------------------------- documento

function HistoriaMascota({ m, opciones, referencia, nuevaPagina }) {
  const activas = m.alergias.filter((a) => a.activa).length;
  return (
    <Flex direction="column" alignItems="stretch" gap={6} className={nuevaPagina ? 'vh-nueva-pagina' : undefined}>
      <Box background="primary100" padding={4} hasRadius className="vh-con-siguiente">
        <Flex justifyContent="space-between" alignItems="center" gap={4} wrap="wrap">
          <Typography variant="beta" tag="h2">{m.nombre}</Typography>
          <Flex gap={2}>
            {activas > 0 && <Insignia color="danger">{activas === 1 ? '1 alergia activa' : `${activas} alergias activas`}</Insignia>}
            <Insignia color="primary">{m.consultas.length === 1 ? '1 consulta' : `${m.consultas.length} consultas`}</Insignia>
          </Flex>
        </Flex>
      </Box>

      <Ficha m={m} referencia={referencia} />

      <Flex direction="column" alignItems="stretch" gap={3}>
        <Titulo>Alergias</Titulo>
        <Alergias alergias={m.alergias} />
      </Flex>

      <Flex direction="column" alignItems="stretch" gap={3}>
        <Titulo>Carné de vacunas</Titulo>
        <Vacunas vacunas={m.vacunas} />
      </Flex>

      <Flex direction="column" alignItems="stretch" gap={3}>
        <Titulo>Consultas</Titulo>
        {m.consultas.length === 0 ? (
          <Tenue>Sin consultas en el periodo.</Tenue>
        ) : (
          m.consultas.map((c) => <Consulta key={c.documentId} c={c} opciones={opciones} />)
        )}
      </Flex>
    </Flex>
  );
}

export function Documento({ historia, opciones }) {
  const { clinica, propietario, mascotas, periodo, generada } = historia;
  // La edad se calcula a la fecha de la historia, no a la de quien la relee.
  const referencia = generada?.el ? new Date(generada.el) : new Date();

  return (
    <Flex direction="column" alignItems="stretch" gap={8}>
      <Encabezado clinica={clinica} generada={generada} periodo={periodo} />
      {propietario && <Propietario p={propietario} />}
      {mascotas.map((m, i) => (
        <HistoriaMascota key={m.documentId} m={m} opciones={opciones} referencia={referencia} nuevaPagina={i > 0} />
      ))}
      <Flex justifyContent="flex-end" paddingTop={8} className="vh-sin-corte">
        <Flex direction="column" alignItems="center" gap={1} style={{ minWidth: 260 }}>
          <Box width="100%" borderColor="neutral800" borderStyle="solid" style={{ borderWidth: '1px 0 0 0' }} />
          <Tenue>Firma y sello del médico veterinario</Tenue>
        </Flex>
      </Flex>
    </Flex>
  );
}
