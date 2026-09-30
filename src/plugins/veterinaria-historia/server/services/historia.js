'use strict';

const { errors } = require('@strapi/utils');

/**
 * Reúne la historia clínica de una o varias mascotas del mismo propietario.
 *
 * Todo va por el Document Service, así que el filtro de archivados
 * (`src/validations/archived.ts`) se aplica solo: una mascota o una consulta
 * archivada no sale en la historia, igual que no sale en el resto de la app.
 *
 * Devuelve datos ya aplanados para pintar; los enums siguen en inglés (los
 * traduce el panel, `admin/src/domain/formato.js`) y los campos `blocks` van
 * tal cual, porque el panel los pinta con su estructura (párrafos, listas…).
 */

const CLIENTE = 'api::customer.customer';
const MASCOTA = 'api::pet.pet';
const CONSULTA = 'api::clinical.consultation';
const VACUNACION = 'api::clinical.pet-vaccination';
const ALERGIA = 'api::clinical.allergy';
const CLINICA = 'api::clinic.clinic';

/** Límite de mascotas por historia: una impresión, no una exportación. */
const MAX_MASCOTAS = 20;

// La zona hay que enumerarla componente a componente: no la alcanza un '*'.
// Misma lista que `api::pet.populate-history` y `demo-historia.js`.
const SECCIONES = {
  'clinical.anamnesis': true,
  'clinical.physical-exam': true,
  'clinical.diagnosis': true,
  'clinical.procedure': true,
  'clinical.lab-result': { populate: ['report'] },
  'clinical.imaging': { populate: ['images'] },
  'clinical.treatment-plan': { populate: ['medications'] },
};

const LINEAS = {
  'clinical.service-line': { populate: { service: { fields: ['name'] } } },
  'clinical.product-line': { populate: { product: { fields: ['name', 'searchLabel'] } } },
};

const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const nombre = (p) => (p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || null : null);
const documento = (p) => (p?.documentNumber ? `${String(p.documentType ?? '').toUpperCase()} ${p.documentNumber}`.trim() : null);
const cuenta = (u) => (u ? `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || null : null);
const archivo = (f) => (f ? { nombre: f.name, url: f.url, mime: f.mime ?? null } : null);

function aMascotaCorta(m) {
  return {
    documentId: m.documentId,
    nombre: m.name,
    especie: m.species?.name ?? null,
    raza: m.breed?.name ?? null,
  };
}

function aCliente(c) {
  return {
    documentId: c.documentId,
    nombre: nombre(c.profile) ?? c.searchLabel ?? 'Cliente sin perfil',
    documento: documento(c.profile),
    mascotas: (c.pets ?? []).map(aMascotaCorta),
  };
}

/** Mascotas no archivadas, ordenadas por nombre. */
const POPULATE_MASCOTAS = {
  profile: true,
  pets: {
    filters: { archivedAt: { $null: true } },
    fields: ['name'],
    sort: ['name:asc'],
    populate: { species: { fields: ['name'] }, breed: { fields: ['name'] } },
  },
};

/** Una sección de la dynamic zone, con sus adjuntos reducidos a nombre y URL. */
function aSeccion(s) {
  const { id, report, images, ...resto } = s;
  return {
    ...resto,
    ...(s.__component === 'clinical.lab-result' ? { report: archivo(report) } : {}),
    ...(s.__component === 'clinical.imaging' ? { images: (images ?? []).map(archivo) } : {}),
    ...(s.__component === 'clinical.treatment-plan'
      ? { medications: (s.medications ?? []).map(({ id: _id, ...m }) => m) }
      : {}),
  };
}

function aLinea(l) {
  return {
    tipo: l.__component === 'clinical.service-line' ? 'servicio' : 'producto',
    nombre: l.service?.name ?? l.product?.name ?? l.label ?? '—',
    cantidad: Number(l.quantity),
    estado: l.state,
    notas: l.notes ?? null,
  };
}

function aConsulta(c) {
  return {
    documentId: c.documentId,
    fecha: c.consultedAt,
    motivo: c.reason ?? null,
    titulo: c.appointment?.title ?? null,
    consultorio: c.appointment?.room?.name ?? null,
    veterinario: cuenta(c.vet),
    pesoKg: c.weightKg ?? null,
    proximoControl: c.nextControlOn ?? null,
    secciones: (c.sections ?? []).map(aSeccion),
    lineas: (c.lines ?? []).map(aLinea),
    adjuntos: (c.attachments ?? []).map((a) => ({
      tipo: a.attachmentKind,
      descripcion: a.description ?? null,
      archivo: archivo(a.file),
    })),
  };
}

/** Rango sobre un campo datetime. Las fechas se guardan en hora de pared. */
function rangoFechaHora(desde, hasta) {
  if (!desde && !hasta) return null;
  return {
    ...(desde ? { $gte: `${desde}T00:00:00.000Z` } : {}),
    ...(hasta ? { $lte: `${hasta}T23:59:59.999Z` } : {}),
  };
}

function rangoFecha(desde, hasta) {
  if (!desde && !hasta) return null;
  return { ...(desde ? { $gte: desde } : {}), ...(hasta ? { $lte: hasta } : {}) };
}

module.exports = ({ strapi }) => {
  const docs = (uid) => strapi.documents(uid);

  async function historiaDeMascota(m, { desde, hasta, orden }) {
    const enConsultas = rangoFechaHora(desde, hasta);
    const enVacunas = rangoFecha(desde, hasta);

    const [alergias, vacunas, consultas] = await Promise.all([
      // Las alergias salen siempre enteras, sin rango: una alergia de hace
      // tres años sigue siendo lo primero que hay que leer.
      docs(ALERGIA).findMany({
        filters: { pet: { documentId: m.documentId } },
        sort: ['isActive:desc', 'diagnosedOn:desc'],
      }),
      docs(VACUNACION).findMany({
        filters: { pet: { documentId: m.documentId }, ...(enVacunas ? { appliedOn: enVacunas } : {}) },
        populate: { vaccine: { fields: ['name', 'manufacturer'] }, vet: { fields: ['firstname', 'lastname'] } },
        sort: [`appliedOn:${orden}`],
      }),
      docs(CONSULTA).findMany({
        filters: { pet: { documentId: m.documentId }, ...(enConsultas ? { consultedAt: enConsultas } : {}) },
        populate: {
          // Nunca `email` de un admin::user: es privado (ver CLAUDE.md).
          vet: { fields: ['firstname', 'lastname'] },
          appointment: { fields: ['title'], populate: { room: { fields: ['name'] } } },
          sections: { on: SECCIONES },
          lines: { on: LINEAS },
          attachments: { populate: ['file'] },
        },
        sort: [`consultedAt:${orden}`],
      }),
    ]);

    return {
      documentId: m.documentId,
      nombre: m.name,
      especie: m.species?.name ?? null,
      raza: m.breed?.name ?? null,
      color: m.color ?? null,
      sexo: m.sex ?? null,
      nacimiento: m.birthDate ?? null,
      pesoKg: m.weightKg ?? null,
      microchip: m.microchip ?? null,
      esterilizacion: m.sterilizationState ?? null,
      esterilizadaEl: m.sterilizedOn ?? null,
      alergias: alergias.map((a) => ({
        alergeno: a.allergen,
        categoria: a.category ?? null,
        severidad: a.severity ?? null,
        reaccion: a.reaction ?? null,
        diagnosticadaEl: a.diagnosedOn ?? null,
        activa: a.isActive !== false,
        resueltaEl: a.resolvedOn ?? null,
        notas: a.notes ?? null,
      })),
      vacunas: vacunas.map((v) => ({
        vacuna: v.vaccine?.name ?? '—',
        laboratorio: v.vaccine?.manufacturer ?? null,
        dosis: v.doseNumber ?? null,
        aplicadaEl: v.appliedOn,
        proximaEl: v.nextDueOn ?? null,
        lote: v.batchNumber ?? null,
        veterinario: cuenta(v.vet),
        notas: v.notes ?? null,
      })),
      consultas: consultas.map(aConsulta),
    };
  }

  async function clinica() {
    const c = await docs(CLINICA).findFirst({ populate: { logo: true, fiscalAddress: true } });
    if (!c) return null;
    const dir = c.fiscalAddress;
    return {
      nombre: c.tradeName || c.legalName,
      razonSocial: c.legalName,
      documento: `${String(c.documentType ?? '').toUpperCase()} ${c.documentNumber}${c.verificationDigit ? '-' + c.verificationDigit : ''}`,
      direccion: dir ? [dir.addressLine, dir.city, dir.region].filter(Boolean).join(', ') : null,
      telefono: c.phone ?? null,
      correo: c.email ?? null,
      web: c.website ?? null,
      logo: c.logo && /^image\/(png|jpe?g|webp|gif)$/.test(c.logo.mime ?? '') ? archivo(c.logo) : null,
    };
  }

  return {
    async buscar(q) {
      const t = texto(q);
      if (!t || t.length < 2) return [];
      const clientes = await docs(CLIENTE).findMany({
        filters: {
          $or: [
            { searchLabel: { $containsi: t } },
            { pets: { name: { $containsi: t }, archivedAt: { $null: true } } },
          ],
        },
        populate: POPULATE_MASCOTAS,
        sort: ['searchLabel:asc'],
        limit: 15,
      });
      return clientes.map(aCliente);
    },

    async cliente(documentId) {
      const c = await docs(CLIENTE).findOne({ documentId, populate: POPULATE_MASCOTAS });
      return c ? aCliente(c) : null;
    },

    /**
     * `mascotas`: documentIds. Tienen que ser todas del mismo propietario: la
     * impresión va a nombre de una persona, y juntar mascotas de dos clientes
     * en un papel sería entregarle a uno los datos del otro.
     */
    async historia({ mascotas, desde, hasta, orden = 'desc' }) {
      const ids = [...new Set(mascotas)];
      if (ids.length === 0) throw new errors.ValidationError('Elige al menos una mascota');
      if (ids.length > MAX_MASCOTAS) throw new errors.ValidationError(`Como máximo ${MAX_MASCOTAS} mascotas por historia`);

      const encontradas = await docs(MASCOTA).findMany({
        filters: { documentId: { $in: ids } },
        populate: {
          species: { fields: ['name'] },
          breed: { fields: ['name'] },
          owner: {
            populate: {
              profile: {
                populate: { contacts: { fields: ['contactType', 'value', 'isPrimary'] }, addresses: true },
              },
            },
          },
        },
      });
      if (encontradas.length !== ids.length) {
        throw new errors.ValidationError('Alguna de las mascotas no existe o está archivada');
      }

      const duenos = new Set(encontradas.map((m) => m.owner?.documentId ?? null));
      if (duenos.size > 1) {
        throw new errors.ValidationError('Las mascotas de una misma historia tienen que ser del mismo propietario');
      }

      // El orden de la petición es el del papel.
      encontradas.sort((a, b) => ids.indexOf(a.documentId) - ids.indexOf(b.documentId));

      const dueno = encontradas[0].owner;
      const perfil = dueno?.profile;
      const contactos = perfil?.contacts ?? [];
      const primero = (tipos) =>
        [...contactos].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).find((c) => tipos.includes(c.contactType))?.value ?? null;
      const dir = (perfil?.addresses ?? []).find((a) => a.isPrimary) ?? perfil?.addresses?.[0];

      const [datosClinica, historias] = await Promise.all([
        clinica(),
        Promise.all(encontradas.map((m) => historiaDeMascota(m, { desde, hasta, orden }))),
      ]);

      return {
        clinica: datosClinica,
        propietario: dueno
          ? {
              documentId: dueno.documentId,
              nombre: nombre(perfil),
              documento: documento(perfil),
              telefono: primero(['phone', 'phone_whatsapp']),
              correo: primero(['email', 'email_work']),
              direccion: dir ? [dir.addressLine, dir.city].filter(Boolean).join(', ') : null,
            }
          : null,
        periodo: { desde: desde ?? null, hasta: hasta ?? null },
        orden,
        mascotas: historias,
      };
    },
  };
};
