import type { Core } from '@strapi/strapi';
import { ValidationError, effective, isAfter, loadCurrent, on, today } from './helpers';

/**
 * Reglas de la configuración de la clínica.
 *
 * Son datos que se tocan una vez al año, pero un error aquí sale en **todas**
 * las facturas: un dígito de verificación mal puesto hace que la DIAN rechace
 * el documento, y un rango de numeración agotado detiene la facturación sin
 * previo aviso. Por eso se valida al guardar y no al facturar.
 */

/**
 * Dígito de verificación del NIT, algoritmo módulo 11 de la DIAN.
 *
 * Los pesos y su orden están fijados por la DIAN; se aplican al NIT leído de
 * derecha a izquierda.
 */
const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export function digitoVerificacion(nit: string): number | null {
  const digitos = String(nit).replace(/\D/g, '');
  if (digitos.length === 0 || digitos.length > PESOS.length) return null;

  const suma = [...digitos]
    .reverse()
    .reduce((acc, d, i) => acc + Number(d) * PESOS[i], 0);

  const resto = suma % 11;
  return resto < 2 ? resto : 11 - resto;
}

export default (strapi: Core.Strapi): void => {
  on(strapi, 'api::clinic.clinic', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['resolutions']);

    const tipo = effective<string>(data, current, 'documentType');
    const numero = effective<string>(data, current, 'documentNumber');
    const dv = effective<string>(data, current, 'verificationDigit');

    // --- dígito de verificación del NIT ---
    if (tipo === 'nit' && numero && dv !== undefined && dv !== null && dv !== '') {
      const esperado = digitoVerificacion(numero);
      if (esperado !== null && String(esperado) !== String(dv)) {
        throw new ValidationError(
          `El dígito de verificación no corresponde al NIT ${numero}: debería ser ${esperado}, no ${dv}`
        );
      }
    }

    // --- resoluciones de facturación ---
    const resoluciones = effective<any[]>(data, current, 'resolutions');
    if (Array.isArray(resoluciones)) {
      const activas = resoluciones.filter((r) => r?.isActive === true);
      if (activas.length > 1) {
        throw new ValidationError(
          `Solo puede haber una resolución activa; hay ${activas.length}. Desactiva las anteriores en lugar de borrarlas: son el histórico.`
        );
      }

      for (const r of resoluciones) {
        const etiqueta = `Resolución ${r.resolutionNumber ?? ''}`.trim();

        if (r.rangeFrom != null && r.rangeTo != null && Number(r.rangeTo) <= Number(r.rangeFrom)) {
          throw new ValidationError(`${etiqueta}: el rango final debe ser mayor que el inicial`);
        }

        if (r.currentNumber != null && r.rangeFrom != null && r.rangeTo != null) {
          const n = Number(r.currentNumber);
          if (n < Number(r.rangeFrom) || n > Number(r.rangeTo)) {
            throw new ValidationError(
              `${etiqueta}: el consecutivo actual (${n}) está fuera del rango autorizado ${r.rangeFrom}–${r.rangeTo}`
            );
          }
        }

        if (r.validFrom && r.validUntil && !isAfter(r.validUntil, r.validFrom)) {
          throw new ValidationError(`${etiqueta}: la vigencia final debe ser posterior a la inicial`);
        }

        // La resolución activa tiene que servir para facturar hoy.
        if (r.isActive === true) {
          if (r.validUntil && String(r.validUntil) < today()) {
            throw new ValidationError(
              `${etiqueta} está activa pero venció el ${r.validUntil}. Carga la nueva resolución antes de seguir facturando.`
            );
          }

          // Quedarse sin numeración detiene la facturación, así que se avisa
          // con margen en vez de esperar al fallo.
          if (r.currentNumber != null && r.rangeTo != null) {
            const restantes = Number(r.rangeTo) - Number(r.currentNumber);
            if (restantes <= 0) {
              throw new ValidationError(
                `${etiqueta}: el rango autorizado está agotado. Solicita una resolución nueva a la DIAN.`
              );
            }
            if (restantes <= 100) {
              strapi.log.warn(
                `[clinic] quedan ${restantes} números en la ${etiqueta}; tramita la próxima resolución`
              );
            }
          }
        }
      }
    }

    // --- horarios ---
    const horarios = effective<any[]>(data, current, 'openingHours');
    if (Array.isArray(horarios)) {
      for (const h of horarios) {
        if (h?.isClosed === true) continue;
        if (h?.opensAt && h?.closesAt && String(h.closesAt) <= String(h.opensAt)) {
          throw new ValidationError(
            `El horario de ${h.dayOfWeek} cierra (${h.closesAt}) antes de abrir (${h.opensAt})`
          );
        }
      }
      const dias = horarios.map((h) => h?.dayOfWeek);
      const repetidos = dias.filter((d, i) => d && dias.indexOf(d) !== i);
      if (repetidos.length > 0) {
        throw new ValidationError(
          `Hay franjas repetidas para: ${[...new Set(repetidos)].join(', ')}. Usa una sola por día.`
        );
      }
    }

    return next();
  });
};
