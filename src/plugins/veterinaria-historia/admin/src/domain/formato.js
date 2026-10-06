/**
 * Dominio del módulo de historia clínica: formato y rótulos. Sin dependencias
 * de React ni de Strapi.
 *
 * Los valores de los enums siguen en inglés en la base (y en la API); aquí se
 * traducen solo para pintarlos.
 */

/** "29 sept. 2026". Una fecha sola (AAAA-MM-DD) no se desplaza de día. */
export function fecha(v) {
  if (!v) return '—';
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(String(v));
  const d = soloFecha ? new Date(`${v}T12:00:00Z`) : new Date(v);
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', ...(soloFecha ? { timeZone: 'UTC' } : {}) }).format(d);
}

export function fechaHora(v) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));
}

export const numero = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const hoy = () => new Date().toISOString().slice(0, 10);

/** "3 años y 2 meses", "5 meses", "12 días". */
export function edad(nacimiento, referencia = new Date()) {
  if (!nacimiento) return null;
  const n = new Date(`${nacimiento}T12:00:00Z`);
  let meses = (referencia.getFullYear() - n.getUTCFullYear()) * 12 + (referencia.getMonth() - n.getUTCMonth());
  if (referencia.getDate() < n.getUTCDate()) meses--;
  if (meses < 0) return null;
  if (meses === 0) {
    const dias = Math.max(0, Math.floor((referencia - n) / 86400000));
    return `${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const txtMeses = `${resto} ${resto === 1 ? 'mes' : 'meses'}`;
  if (anos === 0) return txtMeses;
  const txtAnos = `${anos} ${anos === 1 ? 'año' : 'años'}`;
  return resto ? `${txtAnos} y ${txtMeses}` : txtAnos;
}

const rotulo = (mapa) => (v) => (v == null ? null : mapa[v] ?? v);

export const SEXO = rotulo({ male: 'Macho', female: 'Hembra', unknown: 'Sin dato' });
export const ESTERILIZACION = rotulo({ intact: 'Entero', sterilized: 'Esterilizado', unknown: 'Sin dato' });

export const CATEGORIA_ALERGIA = rotulo({
  food: 'Alimentaria', environmental: 'Ambiental', medication: 'Medicamento', parasite: 'Parasitaria', other: 'Otra',
});

/** Severidad con el color del Design System que le toca. */
export const SEVERIDAD = {
  low: { rotulo: 'Leve', color: 'neutral' },
  moderate: { rotulo: 'Moderada', color: 'warning' },
  high: { rotulo: 'Grave', color: 'danger' },
  life_threatening: { rotulo: 'Riesgo vital', color: 'danger' },
};

export const REFERIDO_POR = rotulo({
  owner: 'el propietario', caretaker: 'el cuidador', referring_vet: 'el veterinario remitente', other: 'otra persona',
});

export const MUCOSAS = rotulo({
  normal: 'normales', pale: 'pálidas', congested: 'congestivas', icteric: 'ictéricas', cyanotic: 'cianóticas',
});

export const HIDRATACION = rotulo({
  normal: 'normal', mild: 'deshidratación leve', moderate: 'deshidratación moderada', severe: 'deshidratación severa',
});

export const PANEL_LAB = rotulo({
  hemogram: 'Hemograma', biochemistry: 'Química sanguínea', urinalysis: 'Uroanálisis', coprology: 'Coprológico',
  cytology: 'Citología', serology: 'Serología', other: 'Otro',
});

export const MODALIDAD = rotulo({
  xray: 'Radiografía', ultrasound: 'Ecografía', ct: 'Tomografía', mri: 'Resonancia magnética',
  endoscopy: 'Endoscopia', other: 'Otra',
});

export const TIPO_DIAGNOSTICO = rotulo({
  presumptive: 'Presuntivo', definitive: 'Definitivo', differential: 'Diferencial', ruled_out: 'Descartado',
});

export const ANESTESIA = rotulo({ none: 'Sin anestesia', local: 'Local', sedation: 'Sedación', general: 'General' });

export const VIA = rotulo({
  oral: 'Oral', sc: 'SC', im: 'IM', iv: 'IV', topical: 'Tópica', otic: 'Ótica', ophthalmic: 'Oftálmica', other: 'Otra',
});

export const ESTADO_LINEA = rotulo({ applied: 'Aplicado', dispensed: 'Entregado', recommended: 'Recomendado' });

export const TIPO_ADJUNTO = rotulo({
  lab_result: 'Laboratorio', x_ray: 'Radiografía', ultrasound: 'Ecografía', photo: 'Foto', other: 'Otro',
});

/** Título de cada sección de la dynamic zone de la consulta. */
export const TITULO_SECCION = {
  'clinical.anamnesis': 'Anamnesis',
  'clinical.physical-exam': 'Exploración física',
  'clinical.lab-result': 'Laboratorio',
  'clinical.imaging': 'Imagen diagnóstica',
  'clinical.diagnosis': 'Diagnóstico',
  'clinical.procedure': 'Procedimiento',
  'clinical.treatment-plan': 'Plan de tratamiento',
};

/** "250 mg · Oral · c/12 h · 7 días". */
export function pauta(m) {
  return [m.dose, VIA(m.route), m.frequencyHours && `c/${m.frequencyHours} h`, m.durationDays && `${m.durationDays} días`]
    .filter(Boolean)
    .join(' · ');
}

/** Constantes de la exploración física como pares etiqueta / valor. */
export function constantes(s) {
  return [
    s.temperatureC != null && ['Temperatura', `${numero(s.temperatureC)} °C`],
    s.heartRateBpm != null && ['Frec. cardiaca', `${s.heartRateBpm} lpm`],
    s.respiratoryRateRpm != null && ['Frec. respiratoria', `${s.respiratoryRateRpm} rpm`],
    s.mucousMembranes && ['Mucosas', MUCOSAS(s.mucousMembranes)],
    s.capillaryRefillSeconds != null && ['TRC', `${numero(s.capillaryRefillSeconds)} s`],
    s.bodyConditionScore != null && ['Condición corporal', `${s.bodyConditionScore}/9`],
    s.hydrationState && ['Hidratación', HIDRATACION(s.hydrationState)],
  ].filter(Boolean);
}

/** Vencida si la próxima dosis ya pasó. */
export const vacunaVencida = (v) => Boolean(v.proximaEl && v.proximaEl < hoy());

/**
 * URL de un archivo de la Media Library. Las del proveedor local son
 * relativas (`/uploads/…`) y el panel puede estar servido desde otro origen
 * en desarrollo.
 */
export function urlArchivo(url) {
  if (!url || /^https?:\/\//.test(url)) return url;
  const base = (typeof window !== 'undefined' && window.strapi?.backendURL) || '';
  return `${base}${url}`;
}

/** Mensaje legible de un error del fetch client del panel. */
export const mensajeDeError = (e, porDefecto) =>
  e?.response?.data?.error?.message ?? e?.message ?? porDefecto;

// ---------------------------------------------------------------- fórmula médica

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
  'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós',
  'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos',
  'ochocientos', 'novecientos'];

function hastaMil(n) {
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const resto = r < 30 ? UNIDADES[r] : `${DECENAS[Math.floor(r / 10)]}${r % 10 ? ` y ${UNIDADES[r % 10]}` : ''}`;
  return [CENTENAS[c], resto].filter(Boolean).join(' ');
}

/**
 * Cantidad en letras para la fórmula ("dos", "medio", "uno y medio"): en una
 * receta en papel la cifra sola se altera con un trazo. Solo enteros y
 * medios; otra fracción devuelve null y se imprime solo la cifra.
 */
export function cantidadEnLetras(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n >= 1000000) return null;
  const entero = Math.floor(n);
  const fraccion = Math.round((n - entero) * 100);
  if (fraccion !== 0 && fraccion !== 50) return null;
  const miles = Math.floor(entero / 1000);
  const resto = entero % 1000;
  const palabras = [miles === 1 ? 'mil' : miles > 1 ? `${hastaMil(miles)} mil` : '', resto ? hastaMil(resto) : '']
    .filter(Boolean)
    .join(' ');
  if (fraccion === 50) return palabras ? `${palabras} y medio` : 'medio';
  return palabras || null;
}

/** "0,1 mg/kg · Oral · cada 24 h · durante 4 días", de un medicamento de la fórmula. */
export function pautaFormula(m) {
  return [
    m.dosis,
    VIA(m.via),
    m.cadaHoras && `cada ${m.cadaHoras} h`,
    m.dias && `durante ${m.dias} ${m.dias === 1 ? 'día' : 'días'}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export const ESTADO_FORMULA = {
  issued: { rotulo: 'Vigente', color: 'success' },
  voided: { rotulo: 'Anulada', color: 'danger' },
};
