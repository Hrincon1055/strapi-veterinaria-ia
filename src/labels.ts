import type { Core } from '@strapi/strapi';
import { includeArchived } from './validations/archived';

/**
 * Etiquetas de búsqueda (`searchLabel`).
 *
 * Strapi muestra en cada selector de relación el "main field" del destino, y
 * la búsqueda de ese selector mira SOLO ese campo (lo dice el propio código de
 * Strapi: "searching should be allowed only on mainField for permission
 * reasons"). Con `firstName` como main field de `profile` no se puede buscar
 * por cédula: no es incómodo, es imposible.
 *
 * Como Strapi no tiene campos calculados, la única salida es una columna real
 * que concatene lo que identifica al registro. Este módulo define cómo se
 * construye cada una; `src/validations/labels.ts` las mantiene al día y
 * `src/bootstrap/main-fields.ts` las declara como main field.
 *
 * Separadores: ` · ` entre datos de la misma entidad, ` — ` antes de la
 * persona o entidad de la que depende.
 */

const MAX = 255;

const unir = (partes: (string | null | undefined)[], sep = ' · '): string =>
  partes.filter((p) => p !== null && p !== undefined && String(p).trim() !== '').join(sep);

const nombrePersona = (p: any): string | null =>
  p ? unir([p.firstName, p.lastName], ' ') || null : null;

const documento = (p: any): string | null =>
  p?.documentType && p?.documentNumber ? `${String(p.documentType).toUpperCase()} ${p.documentNumber}` : null;

/** Perfil completo: nombre y documento, que es lo que lo hace único. */
const etiquetaPerfil = (p: any): string => unir([nombrePersona(p), documento(p)]);

const soloFecha = (v: any): string | null => (v ? String(v).slice(0, 10) : null);

const fechaHora = (v: any): string | null =>
  v ? `${String(v).slice(0, 10)} ${String(v).slice(11, 16)}`.trim() : null;

const MEDIOS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', credit_balance: 'Saldo a favor', other: 'Otro',
};

export type LabelBuilder = {
  /** Relaciones que hay que poblar para construir la etiqueta. */
  populate: any;
  build: (entidad: any) => string;
};

export const LABEL_BUILDERS: Record<string, LabelBuilder> = {
  'api::identity.profile': {
    populate: [],
    build: (e) => etiquetaPerfil(e),
  },

  // Un cliente no tiene nombre propio: lo toma de su perfil.
  'api::customer.customer': {
    populate: ['profile'],
    build: (e) => etiquetaPerfil(e.profile) || 'Cliente sin perfil',
  },

  'api::pet.pet': {
    populate: { species: true, breed: true, owner: { populate: ['profile'] } },
    build: (e) =>
      unir([
        unir([e.name, e.breed?.name ?? e.species?.name]),
        nombrePersona(e.owner?.profile),
      ], ' — '),
  },

  // "Criollo" existe para perro y para gato: sin la especie no se distinguen.
  'api::pet.breed': {
    populate: ['species'],
    build: (e) => (e.species?.name ? `${e.name} (${e.species.name})` : e.name),
  },

  'api::clinical.consultation': {
    populate: { pet: { populate: ['owner'] } },
    build: (e) => unir([fechaHora(e.consultedAt), e.pet?.name, e.reason?.slice(0, 40)]),
  },

  // "RX-000123 · Kira · 2026-10-06": la fórmula se busca por número, y en
  // el mostrador también por el nombre de la mascota.
  'api::clinical.prescription': {
    populate: ['pet'],
    build: (e) => unir([e.number, e.pet?.name, soloFecha(e.issuedAt), e.state === 'voided' ? 'anulada' : null]),
  },

  // Sustituye a `paymentMethodToken`, que es un campo privado y no debería
  // aparecer nunca como etiqueta.
  'api::billing.subscription': {
    populate: ['plan', 'pet'],
    build: (e) => unir([e.plan?.name, e.pet?.name, e.state]),
  },

  // Antes el main field era `dataicoInvoiceId`, vacío hasta que exista la
  // factura electrónica: todas las facturas se veían iguales en un selector.
  'api::billing.invoice': {
    populate: { customer: { populate: ['profile'] } },
    build: (e) =>
      unir([
        e.fullNumber ?? (e.state === 'draft' ? 'Borrador' : e.state),
        nombrePersona(e.customer?.profile),
        soloFecha(e.issuedAt ?? e.createdAt),
      ]),
  },

  'api::shared.contact': {
    populate: ['profile'],
    build: (e) => unir([unir([e.value, e.contactType]), nombrePersona(e.profile)], ' — '),
  },

  'api::notification.notification-recipient': {
    populate: ['recipient', 'notification'],
    build: (e) => unir([nombrePersona(e.recipient), e.notification?.title]),
  },


  // "Amoxicilina 250 mg" existe de varios laboratorios y presentaciones: en el
  // selector de la consulta hay que distinguirlos sin abrir cada uno.
  'api::catalog.product': {
    populate: [],
    build: (e) => unir([e.name, e.presentation, e.brand]),
  },

  // En el selector de una toma o de una factura hay que reconocer al paciente
  // y el ingreso sin abrirlo: mascota, dueño, jaula y día de ingreso.
  'api::hospitalization.hospitalization': {
    populate: { pet: { populate: { owner: { populate: ['profile'] } } }, cage: true },
    build: (e) =>
      unir([
        e.pet?.name,
        e.pet?.owner?.profile?.lastName ?? nombrePersona(e.pet?.owner?.profile),
        e.cage?.name,
        soloFecha(e.admittedAt),
      ]),
  },

  // "Meloxicam 0,1 mg/kg c/24 h — Kira": la toma se registra contra una orden.
  'api::hospitalization.treatment-order': {
    populate: { product: true, hospitalization: { populate: ['pet'] } },
    build: (e) =>
      unir([
        unir([
          e.product?.name,
          e.dose,
          e.isPrn ? 'si es necesario' : e.frequencyHours ? `c/${e.frequencyHours} h` : null,
          e.state !== 'active' ? e.state : null,
        ]),
        e.hospitalization?.pet?.name,
      ], ' — '),
  },

  // "Caja recepción · 2026-10-06 08:00 · Diana Vargas": el turno se elige
  // en los pagos y movimientos por caja, día y persona.
  'api::cash.cash-session': {
    populate: { register: true, responsible: true },
    build: (e) =>
      unir([
        e.register?.name,
        fechaHora(e.openedAt),
        unir([e.responsible?.firstname, e.responsible?.lastname], ' ') || null,
        e.state === 'closed' ? 'cerrado' : null,
      ]),
  },

  // "FE134 · Efectivo · $ 50.000 — Carlos Betancur".
  'api::cash.payment': {
    populate: { invoice: true, customer: { populate: ['profile'] } },
    build: (e) =>
      unir([
        unir([
          e.invoice?.fullNumber ?? (e.purpose === 'advance' ? 'Anticipo' : null),
          e.kind === 'refund' ? 'Devolución' : null,
          MEDIOS[e.method] ?? e.method,
          `$ ${Number(e.amount ?? 0).toLocaleString('es-CO')}`,
          e.state === 'reversed' ? 'reversado' : null,
        ]),
        nombrePersona(e.customer?.profile),
      ], ' — '),
  },

  'api::marketing.campaign-metric': {
    populate: ['campaign'],
    build: (e) => unir([e.campaign?.name, soloFecha(e.createdAt)]),
  },
};

/** Calcula la etiqueta de un documento ya guardado. Devuelve null si no aplica. */
export async function calcularEtiqueta(
  strapi: Core.Strapi,
  uid: string,
  documentId: string
): Promise<string | null> {
  const builder = LABEL_BUILDERS[uid];
  if (!builder) return null;

  const entidad = await strapi.documents(uid as any).findOne({
    documentId,
    populate: builder.populate,
    filters: includeArchived(uid) as any,
  } as any);

  if (!entidad) return null;

  const etiqueta = builder.build(entidad).trim();
  return etiqueta ? etiqueta.slice(0, MAX) : null;
}

/**
 * Recalcula y guarda la etiqueta si cambió.
 *
 * La escritura lleva solo `searchLabel`, y el middleware reconoce esa forma
 * para no volver a entrar: es lo que corta la recursión.
 */
export async function refrescarEtiqueta(
  strapi: Core.Strapi,
  uid: string,
  documentId: string
): Promise<boolean> {
  const etiqueta = await calcularEtiqueta(strapi, uid, documentId);
  if (etiqueta === null) return false;

  const actual = await strapi.documents(uid as any).findOne({
    documentId,
    fields: ['searchLabel'] as any,
    filters: includeArchived(uid) as any,
  } as any);

  if ((actual as any)?.searchLabel === etiqueta) return false;

  await strapi.documents(uid as any).update({
    documentId,
    data: { searchLabel: etiqueta } as any,
  });

  return true;
}
