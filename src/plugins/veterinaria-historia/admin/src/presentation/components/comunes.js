export const RUTA = '/plugins/veterinaria-historia';

/** Enlace a la historia de esas mascotas, con los filtros opcionales. */
export function rutaHistoria(mascotas, filtros = {}) {
  const q = new URLSearchParams({ mascotas: mascotas.join(',') });
  for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, v);
  return `${RUTA}/imprimir?${q}`;
}
