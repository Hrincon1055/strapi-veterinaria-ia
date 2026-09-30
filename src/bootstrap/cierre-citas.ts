import type { Core } from '@strapi/strapi';

/**
 * Cierre nocturno de las citas atendidas que nadie cerró.
 *
 * Quien cierra la atención es el veterinario, con "Finalizar atención" en la
 * ficha de la consulta (plugin de agenda). Esto es la red de seguridad: cada
 * noche pasa a `completed` toda cita que siga abierta, ya tenga consulta y
 * cuya hora de fin haya pasado. Sin consulta no se toca: si nadie la atendió,
 * lo que corresponde es "no asistió" o "cancelada", y eso lo decide recepción.
 *
 * Cierra igual que "Finalizar atención" (servicio del plugin de agenda): si la
 * consulta no tiene ningún servicio aplicado le añade el "Servicio de consulta
 * por defecto" de Clínica, para que la visita llegue a Facturación, que es
 * quien decide si se cobra. Si Clínica no tiene ese servicio, cierra sin
 * añadir nada y Facturación marca la consulta como "sin cargo de consulta".
 *
 * Corre sin sesión, así que la regla de `validations/scheduling.ts` que exige
 * el permiso de finalizar no le aplica (el que llama decide).
 *
 * La hora de las citas es de pared: una cita de las 7:00 se guarda como
 * `07:00Z` (ver `plugins/veterinaria-agenda/server/services/agenda.js`). Por
 * eso "ahora" se compara en la zona de la clínica y con esa misma forma, no
 * con `new Date().toISOString()`, que en Colombia va cinco horas adelantado.
 *
 * La zona se lee de Clínica al arrancar: si se cambia, hace falta reiniciar.
 */

const ABIERTAS = ['scheduled', 'confirmed', 'arrived', 'in_progress'] as const;
const ZONA_POR_DEFECTO = 'America/Bogota';
/** Todos los días a las 23:00 de la clínica. */
const REGLA = '0 23 * * *';

async function zonaDeLaClinica(strapi: Core.Strapi): Promise<string> {
  const clinica = await strapi.db.query('api::clinic.clinic').findOne({ select: ['timezone'] });
  const zona = clinica?.timezone || ZONA_POR_DEFECTO;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zona });
    return zona;
  } catch {
    strapi.log.warn(`[cierre-citas] zona horaria "${zona}" no válida en Clínica; se usa ${ZONA_POR_DEFECTO}`);
    return ZONA_POR_DEFECTO;
  }
}

/** La hora de pared de esa zona, con la forma en que se guardan las citas. */
export function relojDePared(zona: string, ahora = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(ahora)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.000Z`;
}

/** Cierra las citas atendidas y abiertas. Devuelve cuántas cerró. */
export async function cerrarCitasAtendidas(strapi: Core.Strapi, ahora = new Date()): Promise<number> {
  const limite = relojDePared(await zonaDeLaClinica(strapi), ahora);

  const abiertas = await strapi.documents('api::scheduling.appointment').findMany({
    filters: {
      state: { $in: [...ABIERTAS] },
      endAt: { $lte: limite },
      consultation: { id: { $notNull: true } },
    },
    fields: ['documentId', 'startAt'],
    populate: { consultation: { fields: ['documentId'] } },
  });

  const agenda = strapi.plugin('veterinaria-agenda')?.service('agenda');

  let cerradas = 0;
  for (const cita of abiertas) {
    try {
      const consulta = (cita as any).consultation?.documentId;
      const cargo = agenda && consulta ? await agenda.cargoDeConsulta(consulta) : null;
      if (cargo && (cargo.tieneCargo || cargo.servicioPorDefecto)) {
        await agenda.finalizarAtencion(consulta, { usarPorDefecto: true });
      } else {
        await strapi.documents('api::scheduling.appointment').update({
          documentId: cita.documentId,
          data: { state: 'completed' } as any,
        });
      }
      cerradas++;
    } catch (e: any) {
      // Una que falle no frena a las demás.
      strapi.log.error(`[cierre-citas] no se pudo cerrar la cita ${cita.documentId}: ${e?.message}`);
    }
  }

  if (cerradas > 0) {
    strapi.log.info(`[cierre-citas] ${cerradas} cita(s) atendida(s) cerradas automáticamente`);
  }
  return cerradas;
}

export default async (strapi: Core.Strapi): Promise<void> => {
  const tz = await zonaDeLaClinica(strapi);
  strapi.cron.add({
    'cierre-citas': {
      task: async ({ strapi: s }: { strapi: Core.Strapi }) => {
        await cerrarCitasAtendidas(s);
      },
      options: { rule: REGLA, tz },
    },
  });
};
