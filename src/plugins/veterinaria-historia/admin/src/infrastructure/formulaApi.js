/**
 * Infraestructura de la fórmula médica: las llamadas HTTP, con el
 * `fetchClient` del panel (lleva el token de la sesión). Devuelve los datos
 * ya desenvueltos de `{ data }`.
 */

const BASE = '/veterinaria-historia';

export function crearFormulaApi(fetchClient) {
  const datos = (r) => r.data.data;
  return {
    deConsulta: async (consultaId) => datos(await fetchClient.get(`${BASE}/consultations/${consultaId}/prescriptions`)),
    /** `medicamentos`: ids de `clinical.medication` del plan. */
    emitir: async (consultaId, medicamentos) =>
      datos(await fetchClient.post(`${BASE}/consultations/${consultaId}/prescriptions`, { medicamentos })),
    ficha: async (formulaId) => datos(await fetchClient.get(`${BASE}/prescriptions/${formulaId}`)),
    anular: async (formulaId, motivo) => datos(await fetchClient.post(`${BASE}/prescriptions/${formulaId}/void`, { motivo })),
  };
}
