import PDFDocument from 'pdfkit';
import { resumenIva, type Tratamiento } from './calculo';

/**
 * Representación gráfica de la factura, con PDFKit.
 *
 * Recibe los datos ya resueltos (quién emite, a quién, qué renglones) y no
 * sabe de Strapi: el servicio `invoice-pdf` decide si esos datos salen de lo
 * congelado al emitir o, en un borrador, de la ficha actual.
 *
 * No es la factura electrónica: esa la valida la DIAN y lleva CUFE y QR, que
 * se añadirán aquí cuando exista la integración. Mientras tanto el documento
 * lo dice en la cabecera, para que nadie lo tome por un documento validado.
 *
 * Fuentes estándar (Helvetica): cubren el español (tildes, ñ, ¿¡) sin
 * embeber archivos.
 */

export type RenglonPdf = {
  descripcion: string;
  /** Línea secundaria: de qué consulta y mascota sale el concepto. */
  detalle?: string | null;
  cantidad: number;
  unidad?: string | null;
  precioUnitario: number;
  descuento: number;
  tratamiento: Tratamiento;
  tarifa: number;
  subtotal: number;
  impuesto: number;
  total: number;
};

export type DatosPdf = {
  estado: 'draft' | 'issued' | 'voided' | 'dian_error';
  numero: string | null;
  emitidaEl: string | null;
  venceEl: string | null;
  moneda: string;
  notas?: string | null;
  emisor: {
    legalName: string;
    tradeName?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    verificationDigit?: string | null;
    taxRegime?: string | null;
    fiscalResponsibilities?: string[];
    address?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    website?: string | null;
    footerNotes?: string | null;
    invoicingEnvironment?: string | null;
    timezone?: string | null;
  };
  comprador: {
    name?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    address?: string | null;
    city?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  resolucion: {
    numero: string;
    fecha?: string | null;
    prefijo?: string | null;
    desde?: number | string | null;
    hasta?: number | string | null;
    vigenteHasta?: string | null;
  } | null;
  renglones: RenglonPdf[];
  totales: { subtotal: number; descuentos: number; impuesto: number; total: number };
  anulacion?: { el?: string | null; motivo?: string | null } | null;
  /** PNG o JPEG; otro formato se ignora (PDFKit no lo sabe pintar). */
  logo?: Buffer | null;
};

// ---- formato -------------------------------------------------------------

const REGIMEN: Record<string, string> = {
  responsable_iva: 'Responsable de IVA',
  no_responsable_iva: 'No responsable de IVA',
  regimen_simple: 'Régimen Simple de Tributación',
};

const UNIDAD: Record<string, string> = {
  unit: 'und', box: 'caja', bottle: 'frasco', vial: 'vial', bag: 'bolsa', tablet: 'tableta',
  dose: 'dosis', ml: 'ml', g: 'g', kg: 'kg', servicio: 'servicio', periodo: 'periodo',
};

const TRATAMIENTO: Record<Tratamiento, string> = { gravado: 'IVA', exento: 'Exento', excluido: 'Excluido' };

export const formatoDinero = (moneda: string) => {
  const f = new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda || 'COP', maximumFractionDigits: 0 });
  return (n: number) => f.format(Number(n ?? 0));
};

const cantidad = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(Number(n));

/** Fecha sola (AAAA-MM-DD): se formatea sin zona para que no cambie de día. */
function soloFecha(v: string | null | undefined): string {
  if (!v) return '';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${String(v).slice(0, 10)}T12:00:00Z`));
}

function fechaHora(v: string | null | undefined, zona: string): string {
  if (!v) return '';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: zona }).format(new Date(v));
}

const esImagenSoportada = (b?: Buffer | null): b is Buffer =>
  !!b && b.length > 4 &&
  ((b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) || (b[0] === 0xff && b[1] === 0xd8));

// ---- dibujo --------------------------------------------------------------

const MARGEN = 40;
const GRIS = '#555555';
const GRIS_CLARO = '#e6e6e6';
const TINTA = '#111111';

/** Columnas de la tabla de renglones; suman el ancho útil de A4 (515 pt). */
const COLUMNAS = [
  { clave: 'n', titulo: '#', ancho: 18, alinear: 'left' },
  { clave: 'desc', titulo: 'Descripción', ancho: 207, alinear: 'left' },
  { clave: 'cant', titulo: 'Cant.', ancho: 38, alinear: 'right' },
  { clave: 'unidad', titulo: 'Unidad', ancho: 45, alinear: 'left' },
  { clave: 'precio', titulo: 'V. unitario', ancho: 62, alinear: 'right' },
  { clave: 'descuento', titulo: 'Descuento', ancho: 50, alinear: 'right' },
  { clave: 'iva', titulo: 'IVA', ancho: 30, alinear: 'right' },
  { clave: 'total', titulo: 'Total', ancho: 65, alinear: 'right' },
] as const;

export function generarPdf(datos: DatosPdf): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: {
      Title: datos.numero ? `Factura ${datos.numero}` : 'Borrador de factura',
      Author: datos.emisor.legalName,
    },
  });

  const partes: Buffer[] = [];
  const terminado = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => partes.push(c));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });

  const dinero = formatoDinero(datos.moneda);
  const zona = datos.emisor.timezone || 'America/Bogota';
  const ancho = doc.page.width - MARGEN * 2;
  const limiteInferior = () => doc.page.height - MARGEN - 30; // deja sitio al pie

  // --- cabecera: emisor a la izquierda, identificación del documento a la derecha
  const arriba = MARGEN;
  let xTexto = MARGEN;
  if (esImagenSoportada(datos.logo)) {
    try {
      doc.image(datos.logo, MARGEN, arriba, { fit: [70, 70] });
      xTexto = MARGEN + 80;
    } catch {
      // Un logo corrupto no debe impedir la factura.
    }
  }
  const e = datos.emisor;
  const anchoEmisor = 280 - (xTexto - MARGEN);
  doc.fillColor(TINTA).font('Helvetica-Bold').fontSize(12).text(e.tradeName || e.legalName, xTexto, arriba, { width: anchoEmisor });
  doc.font('Helvetica').fontSize(8).fillColor(GRIS);
  const lineasEmisor = [
    e.tradeName ? e.legalName : null,
    e.documentNumber
      ? `${String(e.documentType ?? 'nit').toUpperCase()} ${e.documentNumber}${e.verificationDigit ? `-${e.verificationDigit}` : ''}`
      : null,
    [e.taxRegime ? REGIMEN[e.taxRegime] ?? e.taxRegime : null,
      e.fiscalResponsibilities?.length ? `Resp. ${e.fiscalResponsibilities.map((c) => c.toUpperCase().replace(/_/g, '-')).join(', ')}` : null]
      .filter(Boolean).join(' · ') || null,
    e.address,
    [e.phone ? `Tel. ${e.phone}` : null, e.whatsapp ? `WhatsApp ${e.whatsapp}` : null].filter(Boolean).join(' · ') || null,
    [e.email, e.website].filter(Boolean).join(' · ') || null,
  ].filter(Boolean) as string[];
  for (const l of lineasEmisor) doc.text(l, { width: anchoEmisor });
  const finEmisor = doc.y;

  // Caja del documento.
  const xCaja = MARGEN + ancho - 210;
  const borrador = datos.estado === 'draft';
  doc.roundedRect(xCaja, arriba, 210, 78, 4).lineWidth(0.8).strokeColor('#999999').stroke();
  doc.fillColor(TINTA).font('Helvetica-Bold').fontSize(11)
    .text(borrador ? 'BORRADOR DE FACTURA' : 'FACTURA DE VENTA', xCaja + 10, arriba + 9, { width: 190, align: 'center' });
  doc.fontSize(14).text(borrador ? 'Sin numerar' : `N.º ${datos.numero}`, { width: 190, align: 'center' });
  doc.font('Helvetica').fontSize(7).fillColor(GRIS);
  const aviso = borrador
    ? 'Documento sin validez: no ha sido emitido'
    : e.invoicingEnvironment === 'habilitacion'
      ? 'Ambiente de habilitación DIAN: sin validez fiscal'
      : 'Representación interna, pendiente de validación DIAN';
  doc.text(aviso, xCaja + 10, arriba + 50, { width: 190, align: 'center' });
  if (datos.estado === 'voided') {
    doc.fillColor('#b00020').font('Helvetica-Bold').text('ANULADA', { width: 190, align: 'center' });
  } else if (datos.estado === 'dian_error') {
    doc.fillColor('#b00020').font('Helvetica-Bold').text('RECHAZADA POR LA DIAN', { width: 190, align: 'center' });
  }

  // --- receptor y datos del documento
  let y = Math.max(finEmisor, arriba + 78) + 14;
  const c = datos.comprador;
  const mitad = ancho / 2;
  const bloque = (titulo: string, filas: Array<[string, string | null | undefined]>, x: number, w: number) => {
    doc.fillColor(TINTA).font('Helvetica-Bold').fontSize(8).text(titulo, x, y, { width: w });
    doc.moveDown(0.2);
    for (const [k, v] of filas) {
      if (!v) continue;
      doc.font('Helvetica-Bold').fillColor(GRIS).text(`${k}: `, { continued: true, width: w })
        .font('Helvetica').fillColor(TINTA).text(v, { width: w });
    }
    return doc.y;
  };
  const finReceptor = bloque('CLIENTE', [
    ['Nombre', c.name],
    ['Documento', c.documentNumber ? `${c.documentType ?? ''} ${c.documentNumber}`.trim() : null],
    ['Dirección', c.address],
    ['Correo', c.email],
    ['Teléfono', c.phone],
  ], MARGEN, mitad - 10);
  const finDatos = bloque('DOCUMENTO', [
    ['Fecha de emisión', borrador ? 'Sin emitir' : fechaHora(datos.emitidaEl, zona)],
    ['Vencimiento', datos.venceEl ? soloFecha(datos.venceEl) : borrador ? null : 'De contado'],
    ['Moneda', datos.moneda],
    ['Anulada el', datos.anulacion?.el ? fechaHora(datos.anulacion.el, zona) : null],
    ['Motivo de anulación', datos.anulacion?.motivo ?? null],
  ], MARGEN + mitad + 10, mitad - 10);
  y = Math.max(finReceptor, finDatos) + 14;

  // --- tabla de renglones
  const cabeceraTabla = () => {
    doc.rect(MARGEN, y, ancho, 16).fill(GRIS_CLARO);
    let x = MARGEN;
    doc.fillColor(TINTA).font('Helvetica-Bold').fontSize(7.5);
    for (const col of COLUMNAS) {
      doc.text(col.titulo, x + 3, y + 5, { width: col.ancho - 6, align: col.alinear as any });
      x += col.ancho;
    }
    y += 18;
  };
  cabeceraTabla();

  datos.renglones.forEach((r, i) => {
    const anchoDesc = COLUMNAS[1].ancho - 6;
    doc.font('Helvetica').fontSize(8);
    const altoDesc = doc.heightOfString(r.descripcion, { width: anchoDesc });
    doc.fontSize(6.5);
    const altoDetalle = r.detalle ? doc.heightOfString(r.detalle, { width: anchoDesc }) + 1 : 0;
    const alto = Math.max(altoDesc + altoDetalle, 10) + 7;

    if (y + alto > limiteInferior()) {
      doc.addPage();
      y = MARGEN;
      cabeceraTabla();
    }

    const valores: Record<string, string> = {
      n: String(i + 1),
      cant: cantidad(r.cantidad),
      unidad: r.unidad ? UNIDAD[r.unidad] ?? r.unidad : '',
      precio: dinero(r.precioUnitario),
      descuento: r.descuento ? dinero(r.descuento) : '',
      iva: r.tratamiento === 'gravado' ? `${r.tarifa} %` : r.tratamiento === 'exento' ? 'Ex.' : 'Excl.',
      total: dinero(r.total),
    };
    let x = MARGEN;
    for (const col of COLUMNAS) {
      if (col.clave === 'desc') {
        doc.font('Helvetica').fontSize(8).fillColor(TINTA).text(r.descripcion, x + 3, y + 3, { width: anchoDesc });
        if (r.detalle) doc.fontSize(6.5).fillColor(GRIS).text(r.detalle, x + 3, doc.y + 1, { width: anchoDesc });
      } else {
        doc.font('Helvetica').fontSize(8).fillColor(TINTA)
          .text(valores[col.clave], x + 3, y + 3, { width: col.ancho - 6, align: col.alinear as any });
      }
      x += col.ancho;
    }
    y += alto;
    doc.moveTo(MARGEN, y - 2).lineTo(MARGEN + ancho, y - 2).lineWidth(0.4).strokeColor(GRIS_CLARO).stroke();
  });

  // --- totales (a la derecha) y desglose de IVA (a la izquierda)
  const tramos = resumenIva(datos.renglones.map((r) => ({
    taxTreatment: r.tratamiento, taxRate: r.tarifa, lineSubtotal: r.subtotal, lineTax: r.impuesto,
  })));
  const filasTotales: Array<[string, string, boolean]> = [
    ['Subtotal', dinero(datos.totales.subtotal), false],
    ...(datos.totales.descuentos ? [['Descuentos', `- ${dinero(datos.totales.descuentos)}`, false] as [string, string, boolean]] : []),
    ['IVA', dinero(datos.totales.impuesto), false],
    ['TOTAL', dinero(datos.totales.total), true],
  ];
  const altoResumen = Math.max(filasTotales.length, tramos.length + 1) * 14 + 20;
  if (y + altoResumen > limiteInferior()) {
    doc.addPage();
    y = MARGEN;
  }
  y += 8;
  const yResumen = y;

  doc.fillColor(TINTA).font('Helvetica-Bold').fontSize(7.5).text('Desglose de impuestos', MARGEN, y, { width: 270 });
  y = doc.y + 3;
  for (const t of tramos) {
    const nombre = t.tratamiento === 'gravado' ? `IVA ${t.tarifa} %` : TRATAMIENTO[t.tratamiento];
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
      .text(`${nombre} — base ${dinero(t.base)}${t.tratamiento === 'gravado' ? ` · impuesto ${dinero(t.impuesto)}` : ''}`, MARGEN, y, { width: 270 });
    y = doc.y + 2;
  }
  const finTramos = y;

  y = yResumen;
  const xEtiqueta = MARGEN + ancho - 210;
  for (const [k, v, fuerte] of filasTotales) {
    if (fuerte) {
      doc.rect(xEtiqueta, y - 3, 210, 18).fill(GRIS_CLARO);
    }
    doc.fillColor(TINTA).font(fuerte ? 'Helvetica-Bold' : 'Helvetica').fontSize(fuerte ? 10 : 8.5)
      .text(k, xEtiqueta + 6, y, { width: 100 })
      .text(v, xEtiqueta + 100, y, { width: 104, align: 'right' });
    y += fuerte ? 18 : 14;
  }
  y = Math.max(y, finTramos) + 12;

  // --- notas, resolución y pie legal
  const parrafo = (texto: string, opciones: { negrita?: boolean; tam?: number } = {}) => {
    doc.font(opciones.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(opciones.tam ?? 7.5).fillColor(GRIS);
    const alto = doc.heightOfString(texto, { width: ancho });
    if (y + alto > limiteInferior()) {
      doc.addPage();
      y = MARGEN;
    }
    doc.text(texto, MARGEN, y, { width: ancho });
    y = doc.y + 6;
  };

  if (datos.notas) parrafo(`Observaciones: ${datos.notas}`);
  const res = datos.resolucion;
  if (res) {
    const p = res.prefijo ?? '';
    parrafo(
      `Autorización de numeración de facturación: Resolución DIAN N.º ${res.numero}` +
        `${res.fecha ? ` del ${soloFecha(res.fecha)}` : ''}, del ${p}${res.desde ?? ''} al ${p}${res.hasta ?? ''}` +
        `${res.vigenteHasta ? `, vigente hasta el ${soloFecha(res.vigenteHasta)}` : ''}.`
    );
  }
  if (e.footerNotes) parrafo(e.footerNotes);

  // --- en cada página: marca de agua y pie
  const paginas = doc.bufferedPageRange();
  const marca = datos.estado === 'draft' ? 'BORRADOR' : datos.estado === 'voided' ? 'ANULADA' : null;
  for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
    doc.switchToPage(i);
    if (marca) {
      doc.save();
      doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
      doc.font('Helvetica-Bold').fontSize(96).fillColor('#c8102e').opacity(0.12)
        .text(marca, 0, doc.page.height / 2 - 48, { width: doc.page.width, align: 'center', lineBreak: false });
      doc.restore();
      doc.opacity(1);
    }
    // Escribir por debajo del margen inferior haría que PDFKit abriera otra
    // página: se anula el margen mientras se pinta el pie.
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7).fillColor(GRIS).text(
      `${e.legalName}${datos.numero ? ` · Factura ${datos.numero}` : ''} · Página ${i - paginas.start + 1} de ${paginas.count}`,
      MARGEN, doc.page.height - MARGEN + 8, { width: ancho, align: 'center', lineBreak: false }
    );
    doc.page.margins.bottom = margenInferior;
  }

  doc.end();
  return terminado;
}
