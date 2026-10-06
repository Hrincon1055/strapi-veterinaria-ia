import type { Core } from '@strapi/strapi';
import { on } from './helpers';

/**
 * "Quién lo hizo" se toma de la sesión, nunca del cuerpo de la petición, para
 * que no se pueda suplantar.
 *
 * Antes lo hacían los controladores de la API REST, pero desde que el staff
 * trabaja en el panel (cuentas `admin::user`) sus escrituras ya no pasan por
 * esos controladores: pasan por el Content Manager o por el plugin de agenda.
 * El Document Service es lo único que atraviesan las dos vías, así que la
 * regla vive aquí y lee la sesión con `strapi.requestContext`.
 *
 *  - customer-note.author            -> la cuenta del panel que escribe.
 *  - admittedBy, prescribedBy, recordedBy, administeredBy (hospitalización)
 *                                    -> la cuenta del panel que escribe.
 *  - appointment.bookedBy            -> el PERFIL de quien agenda.
 *  - signed-document-event.performedBy -> el PERFIL de quien actúa.
 *
 * Los dos últimos apuntan a `profile` porque quien actúa puede ser un cliente
 * (reserva en línea, firma) o alguien del staff, y el perfil es lo único que
 * tienen los dos: `profile.user` para la app, `profile.adminUser` para el
 * panel.
 *
 * Sin sesión (bootstrap, scripts, seeds) no se toca nada: el que llama decide.
 */

type Sesion = { tipo: 'panel' | 'app'; id: number };

function sesionActual(strapi: Core.Strapi): Sesion | null {
  const state = strapi.requestContext.get()?.state;
  const id = state?.user?.id;
  if (!id) return null;
  const estrategia = state?.auth?.strategy?.name;
  if (estrategia === 'admin') return { tipo: 'panel', id };
  if (estrategia === 'users-permissions') return { tipo: 'app', id };
  return null;
}

async function perfilDe(strapi: Core.Strapi, s: Sesion): Promise<string | null> {
  const filtro = s.tipo === 'panel' ? { adminUser: { id: s.id } } : { user: { id: s.id } };
  const perfil = await strapi.documents('api::identity.profile').findFirst({ filters: filtro, fields: ['documentId'] });
  return perfil?.documentId ?? null;
}

/**
 * La cuenta del panel que hace la petición, como documentId de `admin::user`,
 * o null fuera de una sesión del panel. La usa también
 * `validations/hospitalization.ts` para `dischargedBy`, que no se pone al
 * crear sino al dar el alta.
 */
export async function cuentaDelPanel(strapi: Core.Strapi): Promise<string | null> {
  const s = sesionActual(strapi);
  if (s?.tipo !== 'panel') return null;
  const cuenta = await strapi.db.query('admin::user').findOne({ where: { id: s.id }, select: ['documentId'] });
  return cuenta?.documentId ?? null;
}

/**
 * Campos que apuntan a la cuenta del panel que crea el registro. Solo el
 * staff escribe en estos content types, así que solo se mira la sesión del
 * panel.
 */
const AUTOR_DEL_PANEL: Array<[string, string]> = [
  ['api::customer.customer-note', 'author'],
  // Hospitalización (5.6).
  ['api::hospitalization.hospitalization', 'admittedBy'],
  ['api::hospitalization.treatment-order', 'prescribedBy'],
  ['api::hospitalization.evolution-entry', 'recordedBy'],
  ['api::hospitalization.medication-administration', 'administeredBy'],
];

export default (strapi: Core.Strapi): void => {
  for (const [uid, campo] of AUTOR_DEL_PANEL) {
    on(strapi, uid, ['create'], async (ctx, next) => {
      const cuenta = await cuentaDelPanel(strapi);
      if (cuenta) ctx.params.data = { ...(ctx.params.data ?? {}), [campo]: cuenta };
      return next();
    });
  }

  for (const [uid, campo] of [
    ['api::scheduling.appointment', 'bookedBy'],
    ['api::documents.signed-document-event', 'performedBy'],
  ] as const) {
    on(strapi, uid, ['create'], async (ctx, next) => {
      const s = sesionActual(strapi);
      if (s) {
        // Si la cuenta no tiene perfil se deja vacío antes que atribuirlo a
        // otra persona o aceptar el que venga en la petición.
        ctx.params.data = { ...(ctx.params.data ?? {}), [campo]: (await perfilDe(strapi, s)) ?? null };
      }
      return next();
    });
  }
};
