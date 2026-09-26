import type { Core } from '@strapi/strapi';

const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedTypes = [
  'image/svg+xml',
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

/**
 * Colecciones que se pueden importar y exportar como CSV.
 *
 * Solo catálogos: son listas largas y sin datos personales, que es justo el
 * caso de uso (cargar 200 razas o una lista de precios de una vez). Las tablas
 * con datos de personas o historia clínica quedan fuera a propósito — el
 * plugin filtra por colección, no por rol, así que habilitarlas daría a
 * cualquier administrador una exportación completa de la base de pacientes en
 * un clic. Si hace falta migrar clientes desde otro sistema, añádelas aquí de
 * forma temporal y vuélvelas a quitar.
 */
const CSV_CATALOGOS = [
  'api::shared.country',
  'api::pet.species',
  'api::pet.breed',
  'api::scheduling.service-category',
  'api::scheduling.service',
  'api::scheduling.clinic-room',
  'api::clinical.vaccine',
  'api::billing.plan',
  'api::billing.plan-benefit',
];

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      jwtManagement: 'refresh',
      sessions: {
        httpOnly: true,
      },
    },
  },

  upload: {
    config: {
      security: {
        allowedTypes: allowedMediaTypes,
        deniedTypes,
      },
    },
  },

  /**
   * OpenAPI en /documentation. El plugin regenera el esquema en cada arranque
   * a partir de los content types, así que no hay que mantenerlo a mano.
   *
   * Subir `info.version` crea una versión nueva del documento en lugar de
   * pisar la anterior.
   */
  documentation: {
    enabled: true,
    config: {
      info: {
        version: '1.0.0',
        title: 'API Veterinaria',
        description:
          'API de la clínica veterinaria: clientes, mascotas, historia clínica, agenda y facturación.',
        contact: {
          name: 'Equipo Veterinaria',
          email: 'soporte@veterinaria.test',
        },
      },
      servers: [
        { url: env('PUBLIC_URL', 'http://localhost:1337') + '/api', description: 'API pública' },
      ],
      'x-strapi-config': {
        // Los content types internos no se publican en la documentación:
        // son cola de trabajo y códigos de un solo uso.
        plugins: ['upload', 'users-permissions'],
      },
    },
  },

  /** Selector de color. Se usa en `service.colorHex` para la agenda. */
  'color-picker': {
    enabled: true,
  },

  'strapi-csv-import-export': {
    enabled: true,
    config: {
      authorizedExports: CSV_CATALOGOS,
      authorizedImports: CSV_CATALOGOS,
    },
  },

  /**
   * Vista de calendario del panel. La colección y los campos de fecha se
   * eligen en Ajustes → Calendar dentro del panel, no aquí: el plugin los
   * guarda en su propio almacén. Para esta clínica: colección
   * `appointment`, inicio `startAt`, fin `endAt`.
   *
   * OJO: este plugin declara sus seis rutas con `auth: false`, incluidas las
   * de escritura de ajustes. Ver la mitigación en config/middlewares.ts.
   */
  'strapi-calendar': {
    enabled: true,
  },

  /** Diagrama de los content types y sus relaciones. Sin configuración. */
  'schema-visualizer': {
    enabled: true,
  },
});

export default config;
