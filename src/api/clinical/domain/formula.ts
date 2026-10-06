import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Marca "esta escritura la hace el servicio de fórmulas"
 * (`api::clinical.prescribing`).
 *
 * Una fórmula lleva un consecutivo y la copia del firmante y de los
 * medicamentos: creada a mano desde el Content Manager o la API saldrían
 * números repetidos o una tarjeta profesional que no es la de quien firma. La
 * regla (`validations/prescription.ts`) solo acepta crearla, o anularla,
 * dentro de esta marca. Mismo mecanismo que `billing/domain/emision.ts`.
 *
 * Los scripts de demo y de prueba la usan también para borrar sus fórmulas
 * (`require('./dist/src/api/clinical/domain/formula')`): es el mismo módulo
 * que cargó Strapi, así que comparten la marca.
 */
const contexto = new AsyncLocalStorage<true>();

export const enServicioDeFormulas = <T>(fn: () => Promise<T>): Promise<T> => contexto.run(true, fn);

export const estaEnServicioDeFormulas = (): boolean => contexto.getStore() === true;

/** "RX-000123". */
export const numeroDeFormula = (secuencia: number): string => `RX-${String(secuencia).padStart(6, '0')}`;
