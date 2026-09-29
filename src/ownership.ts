/**
 * Cadena de propiedad del portal del cliente: `user -> profile -> customer -> pets`.
 *
 * Es el origen único de esa regla, compartido por las dos piezas que la
 * aplican, cada una en su capa:
 *
 * - `src/policies/is-owner.ts` resuelve la propiedad y comprueba las rutas con
 *   `:id` (`owns`), donde un filtro no serviría porque el Document Service
 *   resuelve `findOne` por documentId.
 * - `src/validations/ownership.ts` filtra los listados (`filter`) en la capa de
 *   servicio, después del saneado de parámetros.
 *
 * Añadir aquí un content type lo incorpora a las dos capas a la vez; hacerlo en
 * una sola dejaría un agujero silencioso.
 */

export type Ownership = {
  profileId: string;
  customerId: string;
  petIds: string[];
};

export type OwnershipRule = {
  /** Relaciones que hay que poblar para poder decidir sobre un documento suelto. */
  populate: any;
  /** Filtro de propiedad para un listado. */
  filter: (o: Ownership) => any;
  /** ¿Este documento concreto es del cliente? */
  owns: (entity: any, o: Ownership) => boolean;
};

/** Caso frecuente: la pertenencia se hereda de la mascota. */
const porMascota = (): OwnershipRule => ({
  populate: { pet: { populate: ['owner'] } },
  filter: (o) => ({ pet: { documentId: { $in: o.petIds } } }),
  owns: (e, o) => e?.pet?.owner?.documentId === o.customerId,
});

/** Caso frecuente: la pertenencia es directa contra el cliente. */
const porCliente = (): OwnershipRule => ({
  populate: ['customer'],
  filter: (o) => ({ customer: { documentId: o.customerId } }),
  owns: (e, o) => e?.customer?.documentId === o.customerId,
});

export const OWNERSHIP_RULES: Record<string, OwnershipRule> = {
  'api::identity.profile': {
    populate: [],
    filter: (o) => ({ documentId: o.profileId }),
    owns: (e, o) => e?.documentId === o.profileId,
  },
  'api::shared.contact': {
    populate: ['profile'],
    filter: (o) => ({ profile: { documentId: o.profileId } }),
    owns: (e, o) => e?.profile?.documentId === o.profileId,
  },
  'api::pet.pet': {
    populate: ['owner'],
    filter: (o) => ({ owner: { documentId: o.customerId } }),
    owns: (e, o) => e?.owner?.documentId === o.customerId,
  },
  'api::scheduling.appointment': porMascota(),
  'api::clinical.consultation': porMascota(),
  'api::clinical.pet-vaccination': porMascota(),
  'api::clinical.allergy': porMascota(),
  'api::travel.travel-case': porMascota(),
  'api::billing.subscription': porCliente(),
  'api::billing.invoice': porCliente(),
  'api::billing.invoice-item': {
    populate: { invoice: { populate: ['customer'] } },
    filter: (o) => ({ invoice: { customer: { documentId: o.customerId } } }),
    owns: (e, o) => e?.invoice?.customer?.documentId === o.customerId,
  },
  'api::documents.signed-document': {
    populate: { customer: true, pet: { populate: ['owner'] } },
    filter: (o) => ({
      $or: [{ customer: { documentId: o.customerId } }, { pet: { documentId: { $in: o.petIds } } }],
    }),
    owns: (e, o) =>
      e?.customer?.documentId === o.customerId || e?.pet?.owner?.documentId === o.customerId,
  },
  'api::notification.notification-recipient': {
    populate: ['recipient'],
    filter: (o) => ({ recipient: { documentId: o.profileId } }),
    owns: (e, o) => e?.recipient?.documentId === o.profileId,
  },
};
