import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Marca "esta escritura cambia el precio de catálogo de un renglón con permiso".
 *
 * El precio de un renglón sale del catálogo; para rebajar se usa el descuento,
 * que queda a la vista en la factura. Cambiar el precio es la excepción
 * (servicios de precio variable) y exige el permiso
 * `facturacion.cambiar-precio` y un motivo. Recepción puede editar renglones
 * desde el Content Manager, así que no basta con comprobar el permiso en el
 * controlador del plugin: la regla del renglón solo acepta un precio distinto
 * dentro de `conCambioDePrecio`, que abre el plugin tras comprobarlo.
 *
 * Mismo mecanismo que `emision.ts`: la marca tiene que atravesar el Document
 * Service y sus middlewares.
 */
const contexto = new AsyncLocalStorage<true>();

export const conCambioDePrecio = <T>(fn: () => Promise<T>): Promise<T> => contexto.run(true, fn);

export const cambiandoPrecio = (): boolean => contexto.getStore() === true;
