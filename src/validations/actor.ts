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

export default (strapi: Core.Strapi): void => {
  on(strapi, 'api::customer.customer-note', ['create'], async (ctx, next) => {
    const s = sesionActual(strapi);
    if (s?.tipo === 'panel') {
      const autor = await strapi.db.query('admin::user').findOne({ where: { id: s.id }, select: ['documentId'] });
      ctx.params.data = { ...(ctx.params.data ?? {}), author: autor?.documentId };
    }
    return next();
  });

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
