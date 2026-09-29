/**
 * Datos que se congelan en la factura al emitirla (decisión D2).
 *
 * Una factura de 2025 reimpresa en 2027 tiene que mostrar la dirección del
 * cliente y los datos de la clínica de 2025, no los de hoy. No es un segundo
 * sitio donde administrar esos datos: se copian una vez, al emitir, y no se
 * editan. Se siguen administrando en el perfil y en Clínica.
 */

const texto = (v: any): string | null => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

/** "Calle 10 # 5-20, Bogotá, Cundinamarca". */
export function direccionEnTexto(a: any): string | null {
  if (!a) return null;
  return [a.addressLine, a.city, a.region, a.country?.name].map(texto).filter(Boolean).join(', ') || null;
}

const principalPrimero = (xs: any[]): any[] =>
  [...xs].sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));

/** De qué tipos de contacto sale el correo y el teléfono, en orden de preferencia. */
const CORREOS = ['email', 'email_work'];
const TELEFONOS = ['phone', 'phone_whatsapp', 'phone_emergency'];

function contactoDe(contactos: any[], tipos: string[]): string | null {
  for (const tipo of tipos) {
    const c = principalPrimero((contactos ?? []).filter((x) => x?.contactType === tipo))[0];
    if (c?.value) return c.value;
  }
  return null;
}

/**
 * Receptor (`billing.party-snapshot`) a partir del perfil del cliente, con sus
 * `addresses` (y su país) y `contacts` poblados.
 */
export function comprador(perfil: any) {
  const direccion = principalPrimero(perfil?.addresses ?? [])[0];
  return {
    name: [perfil?.firstName, perfil?.lastName].map(texto).filter(Boolean).join(' ') || null,
    documentType: perfil?.documentType ? String(perfil.documentType).toUpperCase() : null,
    documentNumber: texto(perfil?.documentNumber),
    address: direccionEnTexto(direccion)?.slice(0, 255) ?? null,
    city: texto(direccion?.city),
    email: contactoDe(perfil?.contacts, CORREOS),
    phone: contactoDe(perfil?.contacts, TELEFONOS),
  };
}

/**
 * Emisor a partir de `api::clinic.clinic`, con `logo`, `fiscalAddress` (y su
 * país) y `fiscalResponsibilities` poblados. Nunca lleva credenciales:
 * `technicalKey` pertenece a la resolución y no se copia.
 */
export function emisor(clinica: any) {
  return {
    legalName: clinica.legalName,
    tradeName: texto(clinica.tradeName),
    documentType: clinica.documentType,
    documentNumber: clinica.documentNumber,
    verificationDigit: texto(clinica.verificationDigit),
    personType: clinica.personType,
    taxRegime: clinica.taxRegime,
    fiscalResponsibilities: (clinica.fiscalResponsibilities ?? []).map((r: any) => r.code),
    ciiuCode: texto(clinica.ciiuCode),
    merchantRegistration: texto(clinica.merchantRegistration),
    address: direccionEnTexto(clinica.fiscalAddress),
    city: texto(clinica.fiscalAddress?.city),
    phone: texto(clinica.phone),
    whatsapp: texto(clinica.whatsapp),
    email: texto(clinica.billingEmail) ?? texto(clinica.email),
    website: texto(clinica.website),
    logoUrl: clinica.logo?.url ?? null,
    footerNotes: texto(clinica.invoiceFooterNotes),
    invoicingEnvironment: clinica.invoicingEnvironment,
    timezone: clinica.timezone ?? 'America/Bogota',
  };
}
