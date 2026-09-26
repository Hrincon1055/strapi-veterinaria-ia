import { errors } from '@strapi/utils';

const { ValidationError } = errors;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const E164_RE = /^\+[1-9][0-9]{7,14}$/;
const DOCUMENTOS = ['cc', 'ce', 'ti', 'passport', 'nit', 'ppt'];
const REFERRAL = ['friend', 'social_media', 'google', 'ad', 'walk_in', 'other'];
const MIN_PASSWORD = 8;

/** Lee y valida los campos obligatorios; devuelve el cuerpo ya comprobado. */
function exigir(cuerpo: any, campos: string[]) {
  const faltan = campos.filter((c) => {
    const v = cuerpo?.[c];
    return v === undefined || v === null || String(v).trim() === '';
  });
  if (faltan.length > 0) {
    throw new ValidationError(`Faltan campos obligatorios: ${faltan.join(', ')}`);
  }
}

function validarDocumento(documentType: string) {
  if (!DOCUMENTOS.includes(documentType)) {
    throw new ValidationError(`documentType debe ser uno de: ${DOCUMENTOS.join(', ')}`);
  }
}

function validarPassword(password: string) {
  if (String(password).length < MIN_PASSWORD) {
    throw new ValidationError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);
  }
}

/**
 * Endpoints de alta del portal del cliente. Son públicos a propósito: es por
 * donde entra alguien que todavía no tiene cuenta.
 */
export default {
  /** POST /api/portal/register */
  async register(ctx: any) {
    const cuerpo = ctx.request.body ?? {};
    exigir(cuerpo, ['firstName', 'lastName', 'documentType', 'documentNumber', 'email', 'password']);
    validarDocumento(cuerpo.documentType);
    validarPassword(cuerpo.password);

    if (!EMAIL_RE.test(cuerpo.email)) {
      throw new ValidationError('El correo electrónico no es válido');
    }
    if (cuerpo.phone && !E164_RE.test(cuerpo.phone)) {
      throw new ValidationError('El teléfono debe ir en formato E.164 (ejemplo: +573001234567)');
    }

    // El tratamiento de datos es la única base legal para tener la ficha:
    // sin él no se puede crear. El resto de consentimientos son opcionales.
    const consents = cuerpo.consents ?? {};
    if (consents.dataProcessing !== true) {
      throw new ValidationError('Hay que aceptar el tratamiento de datos personales');
    }

    // Opcional: solo si el formulario preguntó "¿cómo nos conociste?".
    if (cuerpo.referralSource && !REFERRAL.includes(cuerpo.referralSource)) {
      throw new ValidationError(`referralSource debe ser uno de: ${REFERRAL.join(', ')}`);
    }

    const servicio = strapi.service('api::identity.portal') as any;
    const { usuario, perfil } = await servicio.registrar({
      firstName: cuerpo.firstName,
      lastName: cuerpo.lastName,
      documentType: cuerpo.documentType,
      documentNumber: String(cuerpo.documentNumber),
      email: cuerpo.email,
      phone: cuerpo.phone,
      username: cuerpo.username,
      password: cuerpo.password,
      referralSource: cuerpo.referralSource,
      consents: {
        marketing: consents.marketing === true,
        sms: consents.sms === true,
        email: consents.email === true,
        dataProcessing: true,
      },
    });

    ctx.body = {
      jwt: await servicio.emitirJwt(usuario.id),
      user: { documentId: usuario.documentId, username: usuario.username, email: usuario.email },
      profile: { documentId: perfil.documentId },
    };
  },

  /** POST /api/portal/claim/start */
  async claimStart(ctx: any) {
    const cuerpo = ctx.request.body ?? {};
    exigir(cuerpo, ['documentType', 'documentNumber']);
    validarDocumento(cuerpo.documentType);

    const servicio = strapi.service('api::identity.portal') as any;
    ctx.body = await servicio.iniciarReclamacion(
      cuerpo.documentType,
      String(cuerpo.documentNumber)
    );
  },

  /** POST /api/portal/claim/complete */
  async claimComplete(ctx: any) {
    const cuerpo = ctx.request.body ?? {};
    exigir(cuerpo, ['documentType', 'documentNumber', 'code', 'password']);
    validarDocumento(cuerpo.documentType);
    validarPassword(cuerpo.password);

    const servicio = strapi.service('api::identity.portal') as any;
    const { usuario, perfil } = await servicio.completarReclamacion({
      documentType: cuerpo.documentType,
      documentNumber: String(cuerpo.documentNumber),
      code: cuerpo.code,
      username: cuerpo.username,
      password: cuerpo.password,
    });

    ctx.body = {
      jwt: await servicio.emitirJwt(usuario.id),
      user: { documentId: usuario.documentId, username: usuario.username, email: usuario.email },
      profile: { documentId: perfil.documentId },
    };
  },
};
