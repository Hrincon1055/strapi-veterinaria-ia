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
 * La validación es la MISMA que hace la estrategia `admin` de Strapi 5.55
 * (`@strapi/admin/.../strategies/admin.js`): el `sessionManager`. No basta con
 * `jwt.verify` contra `admin.auth.secret`, y hacerlo así estaba mal en los dos
 * sentidos:
 *
 *   - el token que emite el panel lleva `{ userId, sessionId, type: 'access' }`,
 *     no `{ id }`, así que la comprobación de `carga.id` rechazaba al panel
 *     legítimo — verificado: 401 con un token real;
 *   - y un JWT `{ id: 1 }` firmado a mano pasaba, porque no se comprobaba que
 *     existiera una sesión activa. Un token emitido antes de cerrar sesión
 *     seguía valiendo.
 *
 * `validateAccessToken` comprueba firma, tipo y caducidad; `isSessionActive`
 * comprueba que la sesión no se haya revocado ni expirado.
 */

const PREFIJO = '/strapi-calendar';

export default (_config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  return async (ctx: any, next: () => Promise<any>) => {
    if (!ctx.path.startsWith(PREFIJO)) return next();

    const cabecera: string = ctx.request?.header?.authorization ?? '';
    const [esquema, token] = cabecera.split(/\s+/);

    if (esquema?.toLowerCase() !== 'bearer' || !token) {
      return ctx.unauthorized('Se requiere sesión de administrador');
    }

    const sesiones = (strapi as any).sessionManager;
    if (!sesiones) return ctx.unauthorized('Se requiere sesión de administrador');

    const resultado = sesiones('admin').validateAccessToken(token);
    if (!resultado.isValid) {
      return ctx.unauthorized('Se requiere sesión de administrador');
    }

    if (!(await sesiones('admin').isSessionActive(resultado.payload.sessionId))) {
      return ctx.unauthorized('Se requiere sesión de administrador');
    }

    // La sesión puede seguir viva y la cuenta haberse desactivado después.
    const admin = await strapi.db.query('admin::user').findOne({
      where: { id: Number(resultado.payload.userId) },
    });

    if (!admin || admin.isActive !== true || admin.blocked === true) {
      return ctx.unauthorized('Se requiere sesión de administrador');
    }

    return next();
  };
};
