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

  /**
   * Agenda visual del personal: calendario semanal con huecos libres y paso
   * directo de la cita a la consulta. Plugin local, en src/plugins/.
   */
  'veterinaria-agenda': {
    enabled: true,
    resolve: './src/plugins/veterinaria-agenda',
  },

  /**
   * Facturación desde la consulta: pendientes de cobro, borradores, emisión
   * con consecutivo DIAN, PDF y anulación. Plugin local, en src/plugins/.
   * La lógica está en `api::billing.invoicing`; el plugin solo la expone.
   */
  'veterinaria-facturacion': {
    enabled: true,
    resolve: './src/plugins/veterinaria-facturacion',
  },

  /**
   * Historia clínica imprimible de una mascota o de varias del mismo
   * propietario. Plugin local, en src/plugins/. Solo lee.
   */
  'veterinaria-historia': {
    enabled: true,
    resolve: './src/plugins/veterinaria-historia',
  },

  /**
   * Hospitalización: tablero de jaulas, hoja de evolución por hora (signos y
   * tomas), órdenes de tratamiento, traslados y alta. Plugin local, en
   * src/plugins/. La lógica está en `api::hospitalization.ward`; solo aplica
   * si Clínica tiene "Hospitaliza pacientes".
   */
  'veterinaria-hospitalizacion': {
    enabled: true,
    resolve: './src/plugins/veterinaria-hospitalizacion',
  },

  /**
   * Botón "CSV/Excel" en la lista del Content Manager. Sin restricciones el
   * plugin exporta cualquier colección a cualquier cuenta del panel, con
   * campos privados y hashes de contraseña en las relaciones: SOLO catálogos,
   * según el rol, en src/extensions/collection-exporter/strapi-server.ts.
   */
  'collection-exporter': {
    enabled: true,
  },

  /** Diagrama de los content types y sus relaciones. Sin configuración. */
  'schema-visualizer': {
    enabled: true,
  },
});

export default config;
