import crypto from 'crypto';
import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';

const { ValidationError, ApplicationError } = errors;

/**
 * Alta de clientes en el portal.
 *
 * Son dos caminos distintos y no se deben mezclar:
 *
 * 1. `registrar` — persona que la clínica no conoce. Crea user + profile +
 *    customer + contactos de una sola vez.
 *
 * 2. `iniciarReclamacion` / `completarReclamacion` — persona que YA existe como
 *    ficha de mostrador (profile + customer, sin user). No se puede vincular
 *    sin más: si bastara con enviar el número de documento, cualquiera se
 *    apropiaría de la ficha de otro adivinando una cédula. Se envía un código
 *    al contacto que la clínica ya tenía registrado —nunca a uno que aporte
 *    quien pide— y solo al validarlo se crea la cuenta.
 */

/** Sin 0/O/1/I/L para que se pueda dictar por teléfono sin confusiones. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * 8 caracteres sobre 31 símbolos ≈ 8,5·10¹¹ combinaciones.
 *
 * DECISIÓN: código largo en vez de los 6 dígitos habituales de SMS. El esquema
 * `verification-code` del documento de modelo no tiene contador de intentos, y
 * sin contador un código de 6 dígitos (10⁶) se puede reventar a fuerza bruta
 * dentro de su ventana de validez. Con esta longitud el ataque deja de ser
 * viable sin añadir campos al modelo. Si se prefiere el código corto de 6
 * dígitos, hay que añadir `attemptCount` al esquema y bloquear tras N fallos.
 */
const LONGITUD_CODIGO = 8;
const VIGENCIA_MINUTOS = 10;

const generarCodigo = (): string =>
  Array.from({ length: LONGITUD_CODIGO }, () => ALFABETO[crypto.randomInt(0, ALFABETO.length)]).join('');

const hash = (codigo: string): string =>
  crypto.createHash('sha256').update(codigo.trim().toUpperCase()).digest('hex');

/** Comparación en tiempo constante, para no filtrar el código por el tiempo de respuesta. */
function hashesIguales(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** "+573014785512" -> "+57 301 ••• ••12"; "ana@correo.com" -> "a••@correo.com". */
function enmascarar(valor: string, tipo: string): string {
  if (tipo.startsWith('email')) {
    const [usuario, dominio] = valor.split('@');
    return `${usuario.slice(0, 1)}${'•'.repeat(Math.max(usuario.length - 1, 1))}@${dominio}`;
  }
  return `${valor.slice(0, 6)} ••• ••${valor.slice(-2)}`;
}

/** El contacto al que se manda el código: el principal, con preferencia por el teléfono. */
function elegirContacto(contactos: any[]): any | null {
  const orden = (c: any) => (c.contactType.startsWith('phone') ? 0 : 1) + (c.isPrimary ? 0 : 10);
  return [...(contactos ?? [])].sort((a, b) => orden(a) - orden(b))[0] ?? null;
}

const proposito = (contactType: string) =>
  contactType.startsWith('phone') ? 'phone_verification' : 'email_verification';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /** El rol con el que entran los clientes del portal. */
  async rolCliente() {
    const rol = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'client' } });
    if (!rol) throw new ApplicationError('No existe el rol "client"');
    return rol;
  },

  async emitirJwt(userId: number) {
    return strapi.plugin('users-permissions').service('jwt').issue({ id: userId });
  },

  /** Busca la ficha por documento de identidad. */
  async buscarPerfil(documentType: string, documentNumber: string) {
    return strapi.documents('api::identity.profile').findFirst({
      filters: { documentType, documentNumber } as any,
      populate: ['user', 'customer', 'contacts'] as any,
    });
  },

  /**
   * Alta de una persona que la clínica no conoce.
   * Todo en una transacción: o queda user + profile + customer, o no queda nada.
   */
  async registrar(datos: {
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
    email: string;
    phone?: string;
    username?: string;
    password: string;
    consents: Record<string, boolean>;
    referralSource?: string;
  }) {
    const existente = await this.buscarPerfil(datos.documentType, datos.documentNumber);

    if (existente) {
      // La ficha ya está en la clínica. No se crea nada y no se vincula aquí:
      // ese camino es la reclamación, que exige verificar un contacto.
      throw new ApplicationError(
        'Ya existe una ficha con ese documento. Usa la opción de reclamar la cuenta.',
        { code: 'PROFILE_EXISTS' }
      );
    }

    const rol = await this.rolCliente();

    return strapi.db.transaction(async () => {
      const perfil = await strapi.documents('api::identity.profile').create({
        data: {
          firstName: datos.firstName,
          lastName: datos.lastName,
          documentType: datos.documentType,
          documentNumber: datos.documentNumber,
        } as any,
      });

      await strapi.documents('api::shared.contact').create({
        data: {
          profile: perfil.documentId,
          contactType: 'email',
          value: datos.email,
          isPrimary: true,
        } as any,
      });

      if (datos.phone) {
        await strapi.documents('api::shared.contact').create({
          data: {
            profile: perfil.documentId,
            contactType: 'phone',
            value: datos.phone,
            isPrimary: true,
          } as any,
        });
      }

      await strapi.documents('api::customer.customer').create({
        data: {
          profile: perfil.documentId,
          // `referralSource` solo se guarda si el formulario lo preguntó. El
          // enum del modelo no tiene un valor para "se registró en la app", y
          // no se inventa: queda vacío hasta que el cliente lo indique.
          ...(datos.referralSource ? { referralSource: datos.referralSource } : {}),
          consents: datos.consents,
        } as any,
      });

      const usuario = await strapi.plugin('users-permissions').service('user').add({
        username: datos.username ?? datos.email,
        email: datos.email,
        password: datos.password,
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: rol.id,
        profile: perfil.documentId,
      });

      return { usuario, perfil };
    });
  },

  /**
   * Paso 1 de la reclamación: emite un código al contacto que ya tenía la
   * clínica. La respuesta es deliberadamente igual exista o no la ficha, para
   * no convertir el endpoint en un comprobador de cédulas.
   */
  async iniciarReclamacion(documentType: string, documentNumber: string) {
    const neutra = { enviado: true, destino: null as string | null };

    const perfil = await this.buscarPerfil(documentType, documentNumber);
    if (!perfil) return neutra;

    // Ya tiene cuenta: que use el login o el "olvidé mi contraseña" nativos.
    if ((perfil as any).user) return neutra;

    // Sin ficha de cliente no hay nada que reclamar (por ejemplo, el perfil de
    // un miembro del staff): así no se puede usar esto para crearse una cuenta
    // sobre el perfil de un veterinario.
    if (!(perfil as any).customer) return neutra;

    const contacto = elegirContacto((perfil as any).contacts);
    if (!contacto) return neutra;

    const codigo = generarCodigo();
    const expiresAt = new Date(Date.now() + VIGENCIA_MINUTOS * 60_000).toISOString();

    // El middleware de shared.ts invalida los códigos anteriores de ese
    // (contacto, propósito) dentro de la misma transacción.
    await strapi.documents('api::shared.verification-code').create({
      data: {
        contact: contacto.documentId,
        codeHash: hash(codigo),
        purpose: proposito(contacto.contactType),
        expiresAt,
      } as any,
    });

    // No hay proveedor de SMS ni de correo configurado todavía. Hasta que lo
    // haya, el código queda en el log del servidor para que recepción lo pueda
    // dictar por teléfono.
    strapi.log.info(
      `[portal] código de reclamación para ${documentType.toUpperCase()} ${documentNumber}: ${codigo} (vence en ${VIGENCIA_MINUTOS} min)`
    );

    return {
      enviado: true,
      destino: enmascarar(contacto.value, contacto.contactType),
      // Solo fuera de producción, para poder probar el flujo de punta a punta.
      ...(process.env.NODE_ENV === 'production' ? {} : { codigoDesarrollo: codigo }),
    };
  },

  /**
   * Paso 2: valida el código y crea la cuenta enlazada a la ficha existente.
   */
  async completarReclamacion(datos: {
    documentType: string;
    documentNumber: string;
    code: string;
    username?: string;
    password: string;
  }) {
    const generico = new ValidationError('El código no es válido o ya venció');

    const perfil = await this.buscarPerfil(datos.documentType, datos.documentNumber);
    if (!perfil || (perfil as any).user || !(perfil as any).customer) throw generico;

    const contacto = elegirContacto((perfil as any).contacts);
    if (!contacto) throw generico;

    const vigentes = await strapi.documents('api::shared.verification-code').findMany({
      filters: {
        contact: { documentId: contacto.documentId },
        purpose: proposito(contacto.contactType),
        usedAt: { $null: true },
        expiresAt: { $gt: new Date().toISOString() },
      } as any,
    });

    const entrante = hash(datos.code);
    const valido = vigentes.find((c: any) => hashesIguales(c.codeHash, entrante));
    if (!valido) throw generico;

    const rol = await this.rolCliente();

    return strapi.db.transaction(async () => {
      await strapi.documents('api::shared.verification-code').update({
        documentId: valido.documentId,
        data: { usedAt: new Date().toISOString() } as any,
      });

      // Validar el código demuestra que el contacto es suyo.
      await strapi.documents('api::shared.contact').update({
        documentId: contacto.documentId,
        data: { verifiedAt: new Date().toISOString() } as any,
      });

      const correo = (perfil as any).contacts.find((c: any) => c.contactType.startsWith('email'));

      const usuario = await strapi.plugin('users-permissions').service('user').add({
        username: datos.username ?? `${datos.documentType}${datos.documentNumber}`,
        // Sin correo en la ficha se usa uno derivado del documento: el esquema
        // nativo exige email, y el cliente de mostrador puede no tener.
        email: correo?.value ?? `${datos.documentNumber}@sin-correo.local`,
        password: datos.password,
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: rol.id,
        profile: perfil.documentId,
      });

      return { usuario, perfil };
    });
  },
});
