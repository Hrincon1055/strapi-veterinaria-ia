/**
 * Rutas de alta del portal del cliente.
 *
 * Router personalizado (no de factoría): no operan sobre un content type, sino
 * que orquestan profile + customer + user.
 *
 * Quedan bajo el sistema de permisos nativo, no con `auth: false`. Es el rol
 * Public quien las tiene concedidas, en `src/bootstrap/roles.ts`, así que se
 * pueden revocar desde el panel como cualquier otro permiso.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/portal/register',
      handler: 'portal.register',
    },
    {
      method: 'POST',
      path: '/portal/claim/start',
      handler: 'portal.claimStart',
    },
    {
      method: 'POST',
      path: '/portal/claim/complete',
      handler: 'portal.claimComplete',
    },
  ],
};
