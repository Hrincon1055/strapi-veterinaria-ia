'use strict';

/**
 * Rutas del módulo de historia clínica. `type: 'admin'`: las protege la
 * sesión del panel, no la de content-api. Las de la historia exigen
 * `historia.ver`; las de la fórmula médica, sus propios permisos.
 */
const ver = { policies: ['plugin::veterinaria-historia.puede-ver-historia'] };

/** Fórmula médica: `formula.emitir` (o `formula.anular`, que la administración tiene también). */
const formula = (...acciones) => ({
  policies: [{ name: 'plugin::veterinaria-historia.tiene-permiso', config: { acciones } }],
});
const emitir = formula('formula.emitir');

module.exports = {
  admin: {
    type: 'admin',
    routes: [
      // Clientes por nombre, documento o nombre de una de sus mascotas.
      { method: 'GET', path: '/customers', handler: 'historia.buscar', config: ver },
      { method: 'GET', path: '/customers/:id', handler: 'historia.cliente', config: ver },
      // La historia de una o varias mascotas del mismo propietario.
      { method: 'GET', path: '/history', handler: 'historia.historia', config: ver },

      // Fórmulas de una consulta, los medicamentos de su plan y si la cuenta puede firmar.
      { method: 'GET', path: '/consultations/:id/prescriptions', handler: 'formula.deConsulta', config: emitir },
      { method: 'POST', path: '/consultations/:id/prescriptions', handler: 'formula.emitir', config: emitir },
      // Lo que se imprime.
      { method: 'GET', path: '/prescriptions/:id', handler: 'formula.ficha', config: emitir },
      // La propia la anula quien la firmó; la ajena, quien tenga `formula.anular`.
      { method: 'POST', path: '/prescriptions/:id/void', handler: 'formula.anular', config: formula('formula.emitir', 'formula.anular') },
    ],
  },
};
