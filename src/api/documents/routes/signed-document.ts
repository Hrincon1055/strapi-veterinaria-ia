import { factories } from '@strapi/strapi';

/**
 * Documentos firmados. `files` es un componente repetible y `signers` una
 * relación: ninguno de los dos llega sin pedirlo, y un documento sin sus
 * archivos ni sus firmantes no sirve de nada en pantalla.
 *
 * `?pendientes=true` no existe como atajo porque el estado ya lo cubre:
 * `?estado=pending_signature`.
 */
const ownerOnly = { policies: ['global::is-owner'] };

const lectura = {
  ...ownerOnly,
  middlewares: [
    'global::date-range',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'createdAt:desc',
        populate: {
          files: { populate: ['file'] },
          signers: { populate: ['signer'] },
          pet: true,
        },
        atajos: {
          estado: { campo: 'state' },
          tipo: { campo: 'documentType' },
          pet: { campo: 'pet', relacionPor: 'documentId' },
          venceAntesDe: { campo: 'expiresAt', operador: '$lte' },
          desde: { campo: 'createdAt', operador: '$gte' },
          hasta: { campo: 'createdAt', operador: '$lte' },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::documents.signed-document', {
  config: { find: lectura, findOne: lectura, update: ownerOnly, delete: ownerOnly },
});
