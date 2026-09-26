import jwt from 'jsonwebtoken';
import type { Core } from '@strapi/strapi';

/**
 * Exige sesión de administrador en las rutas de `@offset-dev/strapi-calendar`.
 *
 * El plugin declara sus SEIS rutas con `auth: false`, así que sin esto quedan
 * abiertas a cualquiera que alcance el servidor:
 *
 *   GET  /strapi-calendar/collections   vuelca el esquema completo de todos
 *                                       los content types
 *   POST /strapi-calendar/settings      permite apuntar el calendario a
 *                                       cualquier colección
 *   GET  /strapi-calendar/              devuelve entonces las filas de esa
 *                                       colección
 *
 * Encadenando las dos últimas, un anónimo puede leer datos de pacientes. No es
 * un fallo de este proyecto sino del plugin; mientras no lo corrijan, se tapa
 * aquí.
 *
 * Se valida el JWT del panel contra `admin.auth.secret` y se comprueba que la
 * cuenta siga existiendo y activa — es lo mismo que hace la estrategia de
 * autenticación del admin. El panel del calendario usa `getFetchClient`, que
 * envía ese token, así que la interfaz sigue funcionando igual.
 */

const PREFIJO = '/strapi-calendar';

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<any>) => {
    if (!ctx.path.startsWith(PREFIJO)) return next();

    const cabecera: string = ctx.request?.header?.authorization ?? '';
    const [esquema, token] = cabecera.split(' ');

    if (esquema?.toLowerCase() !== 'bearer' || !token) {
      return ctx.unauthorized('Se requiere sesión de administrador');
    }

    let carga: any;
    try {
      carga = jwt.verify(token, strapi.config.get('admin.auth.secret') as string);
    } catch {
      return ctx.unauthorized('Se requiere sesión de administrador');
    }

    // El token del panel lleva el id del administrador. Un token de la API de
    // contenido (users-permissions) va firmado con otro secreto y ya habría
    // fallado arriba, pero se comprueba igualmente que la cuenta exista.
    const admin = carga?.id
      ? await strapi.db.query('admin::user').findOne({ where: { id: carga.id } })
      : null;

    if (!admin || admin.isActive === false || admin.blocked === true) {
      return ctx.unauthorized('Se requiere sesión de administrador');
    }

    return next();
  };
};
