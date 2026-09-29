import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Marca "esta escritura la hace el servicio de emisión".
 *
 * Emitir es asignar un consecutivo de la resolución DIAN: si se pudiera pasar
 * una factura a `issued` escribiendo `number` y `fullNumber` a mano (desde el
 * Content Manager o la API), aparecerían números que la resolución no
 * registra, saltos o duplicados que la DIAN rechaza. Por eso la regla de la
 * factura solo acepta ese paso dentro de `enEmision`, que es lo que hace
 * `api::billing.invoicing.emitir` tras incrementar el consecutivo.
 *
 * AsyncLocalStorage y no un parámetro: la marca tiene que atravesar el
 * Document Service y sus middlewares, que no dejan pasar datos extra.
 */
const contexto = new AsyncLocalStorage<true>();

export const enEmision = <T>(fn: () => Promise<T>): Promise<T> => contexto.run(true, fn);

export const estaEmitiendo = (): boolean => contexto.getStore() === true;
