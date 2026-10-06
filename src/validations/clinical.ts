import { randomUUID } from 'node:crypto';
import type { Core } from '@strapi/strapi';
import {
  ValidationError,
  assertNoDuplicate,
  effective,
  effectiveRelation,
  isAfter,
  loadCurrent,
  on,
  porId,
  previaDe,
  relacionDeComponente,
  today,
} from './helpers';
import { includeArchived } from './archived';
import { LINEAS_FACTURABLES } from '../api/billing/domain/fuentes';

/**
 * Tarjetas de la zona `lines` (Servicios y productos): qué relación lleva cada
 * una y de dónde sale su nombre. Añadir un tipo de línea = una entrada aquí,
 * otra en `populate-sections` y otra en `populate-history`.
 *
 * Lo que antes eran reglas —"servicio o producto, no los dos", "entregado solo
 * para productos"— ahora lo impone el propio componente: cada tarjeta tiene un
 * único selector y su propia lista de estados.
 */
const LINEAS: Record<string, { campo: string; uid: string; nombre: string; etiqueta: string }> = {
  'clinical.service-line': { campo: 'service', uid: 'api::scheduling.service', nombre: 'servicio', etiqueta: 'name' },
  'clinical.product-line': { campo: 'product', uid: 'api::catalog.product', nombre: 'producto', etiqueta: 'searchLabel' },
};

const POPULATE_LINEAS = {
  on: {
    'clinical.service-line': { populate: ['service'] },
    'clinical.product-line': { populate: ['product'] },
  },
};

/**
 * `lineKey` es la identidad de la línea como concepto facturable: el renglón
 * de factura que la cobra la guarda para siempre. No puede ser el `id` del
 * componente, que no sobrevive a una migración ni a recrear la zona.
 *
 * La pone el servidor y se ignora lo que llegue, con una excepción: una clave
 * que ya pertenece a una línea guardada de ESTA consulta se respeta, para que
 * un cliente de la API que reenvía la zona sin `id` no rompa la trazabilidad.
 *
 * Dos pasadas porque el panel puede duplicar un bloque: la copia llega sin
 * `id` pero con la clave del original, y el original (que sí trae `id`) tiene
 * prioridad sobre ella.
 */
function asignarClaves(lineas: any[], guardadasLista: any[] | undefined, guardadas: Map<string, any>): void {
  const existentes = new Set((guardadasLista ?? []).map((l: any) => l?.lineKey).filter(Boolean));
  const usadas = new Set<string>();
  const pendientes: any[] = [];

  for (const linea of lineas) {
    if (!linea || !LINEAS[linea.__component]) continue;
    const clave = previaDe(guardadas, linea)?.lineKey;
    if (clave && !usadas.has(clave)) {
      linea.lineKey = clave;
      usadas.add(clave);
    } else {
      pendientes.push(linea);
    }
  }

  for (const linea of pendientes) {
    const pedida = typeof linea.lineKey === 'string' ? linea.lineKey : null;
    const clave = pedida && existentes.has(pedida) && !usadas.has(pedida) ? pedida : randomUUID();
    linea.lineKey = clave;
    usadas.add(clave);
  }
}

/** Renglones de factura viva (con `lockKey`) que cobran líneas de la consulta. */
async function renglonesVivos(strapi: Core.Strapi, consultaDocumentId: string): Promise<any[]> {
  return strapi.documents('api::billing.invoice-item').findMany({
    filters: { sourceConsultation: { documentId: consultaDocumentId }, lockKey: { $notNull: true } } as any,
    populate: {
      invoice: { fields: ['documentId', 'fullNumber', 'state'], filters: includeArchived('api::billing.invoice') },
      service: { fields: ['documentId'] },
      product: { fields: ['documentId'] },
    } as any,
  } as any);
}

const nombreDeFactura = (f: any): string => (f?.fullNumber ? `la factura ${f.fullNumber}` : 'un borrador de factura');

/**
 * Fórmulas médicas emitidas desde la consulta (`api::clinical.prescription`).
 * Con `soloVigentes`, las que no están anuladas.
 */
async function formulasDe(strapi: Core.Strapi, consultaDocumentId: string, soloVigentes = false): Promise<any[]> {
  return strapi.documents('api::clinical.prescription' as any).findMany({
    filters: { consultation: { documentId: consultaDocumentId }, ...(soloVigentes ? { state: 'issued' } : {}) } as any,
    fields: ['number', 'state'] as any,
    sort: ['sequence:asc'],
  } as any);
}

/**
 * Medicamentos de los planes de tratamiento (`clinical.medication`, anidado
 * en `clinical.treatment-plan`): el producto, si lo hay, es un medicamento
 * del catálogo, y la cantidad a dispensar es positiva. Sin `drug`, toma el
 * nombre del producto.
 *
 * El componente está dos niveles por debajo de la consulta, así que el
 * guardado se empareja en dos pasos (plan por `id`, luego medicamento por
 * `id`) para leer bien la diferencia vacía que manda el panel. Solo se exige
 * "activo" si el producto cambia: desactivar un producto del catálogo no
 * debe impedir editar las consultas antiguas que lo recetaron.
 */
async function validarMedicacion(strapi: Core.Strapi, secciones: any[], guardadas: any[] | undefined): Promise<void> {
  const planesGuardados = porId(guardadas);
  for (const plan of secciones) {
    if (plan?.__component !== 'clinical.treatment-plan' || !Array.isArray(plan.medications)) continue;
    const medsGuardados = porId(previaDe(planesGuardados, plan)?.medications);

    for (const m of plan.medications) {
      if (!m) continue;
      if (m.quantity !== undefined && m.quantity !== null && m.quantity !== '' && !(Number(m.quantity) > 0)) {
        throw new ValidationError('La cantidad a dispensar de un medicamento tiene que ser mayor que 0');
      }

      const previa = previaDe(medsGuardados, m);
      const productoId = relacionDeComponente(m.product, previa, 'product');
      if (!productoId) continue;

      const p: any = await strapi.documents('api::catalog.product').findOne({
        documentId: productoId,
        fields: ['name', 'productType', 'isActive'] as any,
      });
      if (!p) throw new ValidationError('El producto indicado en la medicación no existe');
      if (p.productType !== 'medication') {
        throw new ValidationError(`"${p.name}" es de tipo "${p.productType}": en la medicación del plan solo van medicamentos del catálogo`);
      }
      if (p.isActive === false && productoId !== previa?.product?.documentId) {
        throw new ValidationError(`"${p.name}" está inactivo en el catálogo`);
      }
      if (!m.drug || !String(m.drug).trim()) m.drug = String(p.name).slice(0, 150);
    }
  }
}

/**
 * Una línea que ya se está cobrando no puede cambiar lo que se cobra: ni
 * desaparecer, ni cambiar de servicio o producto, ni de cantidad, ni dejar de
 * ser facturable. Si la historia clínica y la factura divergen, ninguna de las
 * dos es fiable. Para corregirla hay que quitarla del borrador o anular la
 * factura; entonces la línea se libera.
 *
 * Lo demás de la línea (notas, el paso de `applied` a `dispensed`) sí se puede
 * tocar: no cambia lo cobrado.
 */
async function exigirLineasFacturadasIntactas(
  strapi: Core.Strapi,
  consultaDocumentId: string,
  lineas: any[],
  destinoPorClave: Map<string, string>
): Promise<void> {
  const vivos = await renglonesVivos(strapi, consultaDocumentId);
  if (vivos.length === 0) return;

  const entrantes = new Map(lineas.filter((l) => l?.lineKey).map((l) => [l.lineKey, l]));

  for (const r of vivos) {
    const linea = entrantes.get(r.lockKey);
    const donde = nombreDeFactura(r.invoice);
    const nombre = `"${r.description}"`;
    const pista = 'Quítala del borrador o anula la factura antes de cambiarla.';

    if (!linea) {
      throw new ValidationError(`La línea ${nombre} se está cobrando en ${donde} y no se puede quitar. ${pista}`);
    }
    // El renglón guarda el servicio o producto que tenía la línea al cobrarse.
    const tipo = LINEAS[linea.__component];
    const destinoCobrado = tipo ? r[tipo.campo]?.documentId : undefined;
    if (!tipo || !destinoCobrado || destinoPorClave.get(linea.lineKey) !== destinoCobrado) {
      throw new ValidationError(`La línea ${nombre} se está cobrando en ${donde}: no puede cambiar de ${tipo?.nombre ?? 'concepto'}. ${pista}`);
    }
    if (Number(linea.quantity) !== Number(r.quantity)) {
      throw new ValidationError(`La línea ${nombre} se está cobrando en ${donde} por ${Number(r.quantity)}: no puede cambiar de cantidad. ${pista}`);
    }
    if (!LINEAS_FACTURABLES[linea.__component]?.facturable(linea)) {
      throw new ValidationError(`La línea ${nombre} se está cobrando en ${donde}: no puede pasar a "${linea.state}". ${pista}`);
    }
  }
}

export default (strapi: Core.Strapi): void => {
  // ---- api::clinical.vaccine ----------------------------------------------

  on(strapi, 'api::clinical.vaccine', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['species']);

    const species = effectiveRelation(data, current, 'species');
    const name = effective<string>(data, current, 'name');

    if (species && name) {
      await assertNoDuplicate(
        strapi,
        'api::clinical.vaccine',
        { species: { documentId: species }, name },
        ctx.params.documentId,
        `La vacuna "${name}" ya existe para esa especie`
      );
    }

    return next();
  });

  // ---- api::clinical.consultation -----------------------------------------

  on(strapi, 'api::clinical.consultation', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, {
      pet: true,
      lines: POPULATE_LINEAS,
      sections: { on: { 'clinical.treatment-plan': { populate: { medications: { populate: ['product'] } } } } },
    });

    // Si no se indica el momento de la consulta, es ahora.
    if (ctx.action === 'create' && !data.consultedAt) {
      data.consultedAt = new Date().toISOString();
      ctx.params.data = data;
    }

    if (Array.isArray(data.sections)) {
      await validarMedicacion(strapi, data.sections, current?.sections);
      ctx.params.data = data;
    }

    // Servicios y productos de la consulta (zona `lines`): qué aplicó, entregó
    // o recomendó el veterinario, y cuánto. La facturación convertirá en cargo
    // cada línea con el precio y el impuesto del catálogo. Un componente no
    // atraviesa el Document Service por su cuenta, solo como parte de su
    // padre, así que la regla vive aquí.
    if (Array.isArray(data.lines)) {
      const guardadas = porId(current?.lines);
      asignarClaves(data.lines, current?.lines, guardadas);
      const destinoPorClave = new Map<string, string>();

      for (const linea of data.lines) {
        const tipo = LINEAS[linea?.__component];
        if (!tipo) continue; // Strapi rechaza por su cuenta un componente ajeno a la zona.

        const previa = previaDe(guardadas, linea);
        const documentId = relacionDeComponente(linea[tipo.campo], previa, tipo.campo);
        if (!documentId) {
          throw new ValidationError(`Cada línea de ${tipo.nombre} de la consulta debe indicar qué ${tipo.nombre} es`);
        }

        // El panel pinta en la cabecera de un bloque cerrado el valor de un
        // campo de texto del componente; una relación no sirve para eso. Sin
        // `label`, todas las cabeceras dirían solo "Producto" o "Servicio".
        // Lo pone siempre el servidor: se ignora lo que llegue.
        const destino: any = await strapi.documents(tipo.uid as any).findOne({
          documentId,
          fields: ['name', tipo.etiqueta] as any,
        });
        if (!destino) {
          throw new ValidationError(`El ${tipo.nombre} indicado no existe`);
        }
        linea.label = String(destino[tipo.etiqueta] ?? destino.name ?? '').slice(0, 255) || null;
        destinoPorClave.set(linea.lineKey, documentId);
      }
      ctx.params.data = data;

      if (ctx.action === 'update') {
        await exigirLineasFacturadasIntactas(strapi, ctx.params.documentId, data.lines, destinoPorClave);
      }
    }

    // Una consulta con conceptos en una factura viva no cambia de mascota
    // (la factura es del dueño) ni se archiva (la factura la sigue citando).
    if (ctx.action === 'update') {
      // `relacionDeComponente` trata la diferencia vacía del panel como "sin cambio".
      const cambiaMascota = 'pet' in data && relacionDeComponente(data.pet, current, 'pet') !== current?.pet?.documentId;
      const seArchiva = !!data.archivedAt && !current?.archivedAt;
      if (cambiaMascota || seArchiva) {
        const vivos = await renglonesVivos(strapi, ctx.params.documentId);
        if (vivos.length > 0) {
          throw new ValidationError(
            `Esta consulta tiene conceptos en ${nombreDeFactura(vivos[0].invoice)}: no puede ` +
              `${cambiaMascota ? 'cambiar de mascota' : 'archivarse'} mientras esa factura esté viva`
          );
        }
        // La fórmula va a nombre de la mascota y cita la consulta.
        const formulas = await formulasDe(strapi, ctx.params.documentId, true);
        if (formulas.length > 0) {
          throw new ValidationError(
            `Esta consulta tiene la fórmula médica ${formulas[0].number} vigente: no puede ` +
              `${cambiaMascota ? 'cambiar de mascota' : 'archivarse'} sin anularla antes`
          );
        }
      }
    }

    const consultedAt = effective<string>(data, current, 'consultedAt');
    const nextControlOn = effective<string>(data, current, 'nextControlOn');

    if (nextControlOn && consultedAt && !isAfter(nextControlOn, consultedAt)) {
      throw new ValidationError(
        'La fecha del próximo control debe ser posterior a la fecha de la consulta'
      );
    }

    const result = await next();

    // El peso tomado en consulta pasa a ser el peso actual de la mascota.
    if (data.weightKg !== undefined && data.weightKg !== null) {
      const petId = effectiveRelation(data, current, 'pet') ?? (result as any)?.pet?.documentId;
      if (petId) {
        await strapi.documents('api::pet.pet').update({
          documentId: petId,
          data: { weightKg: data.weightKg } as any,
        });
      }
    }

    return result;
  });

  // Borrar una consulta cobrada dejaría la factura citando una historia que
  // ya no existe (y sus renglones sin línea de origen).
  on(strapi, 'api::clinical.consultation', ['delete'], async (ctx, next) => {
    if (ctx.params?.documentId) {
      const vivos = await renglonesVivos(strapi, ctx.params.documentId);
      if (vivos.length > 0) {
        throw new ValidationError(
          `Esta consulta tiene conceptos en ${nombreDeFactura(vivos[0].invoice)}: no se puede borrar mientras esa factura esté viva`
        );
      }
      // Una fórmula, aun anulada, no se borra: la consulta que la respalda tampoco.
      const formulas = await formulasDe(strapi, ctx.params.documentId);
      if (formulas.length > 0) {
        throw new ValidationError(
          `Esta consulta respalda la fórmula médica ${formulas[0].number}: no se puede borrar (archívala si no está vigente)`
        );
      }
    }
    return next();
  });

  // ---- api::clinical.pet-vaccination --------------------------------------

  on(strapi, 'api::clinical.pet-vaccination', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx, ['pet', 'vaccine']);

    const petId = effectiveRelation(data, current, 'pet');
    const vaccineId = effectiveRelation(data, current, 'vaccine');
    const appliedOn = effective<string>(data, current, 'appliedOn');
    const nextDueOn = effective<string>(data, current, 'nextDueOn');

    // La vacuna debe ser de la misma especie que la mascota.
    if (petId && vaccineId) {
      const [pet, vaccine] = await Promise.all([
        strapi.documents('api::pet.pet').findOne({ documentId: petId, populate: ['species'] as any }),
        strapi.documents('api::clinical.vaccine').findOne({
          documentId: vaccineId,
          populate: ['species'] as any,
        }),
      ]);
      const petSpecies = (pet as any)?.species?.documentId;
      const vaccineSpecies = (vaccine as any)?.species?.documentId;
      if (petSpecies && vaccineSpecies && petSpecies !== vaccineSpecies) {
        throw new ValidationError('Esa vacuna no corresponde a la especie de la mascota');
      }
    }

    if (appliedOn && appliedOn > today()) {
      throw new ValidationError('La fecha de aplicación no puede ser futura');
    }

    if (nextDueOn && appliedOn && !isAfter(nextDueOn, appliedOn)) {
      throw new ValidationError(
        'La fecha del próximo refuerzo debe ser posterior a la de aplicación'
      );
    }

    return next();
  });

  // ---- api::clinical.allergy ----------------------------------------------

  on(strapi, 'api::clinical.allergy', ['create', 'update'], async (ctx, next) => {
    const data = ctx.params.data ?? {};
    const current = await loadCurrent(strapi, ctx);

    const isActive = effective<boolean>(data, current, 'isActive');
    const resolvedOn = effective<string>(data, current, 'resolvedOn');

    if (isActive === false && !resolvedOn) {
      throw new ValidationError(
        'Una alergia inactiva necesita la fecha en que se resolvió (resolvedOn)'
      );
    }

    return next();
  });
};
