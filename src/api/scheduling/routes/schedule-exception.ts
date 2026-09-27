import { factories } from '@strapi/strapi';

/**
 * Ausencias y turnos extra. Lo que más se consulta es "qué ausencias hay en
 * este rango", de ahí que `?desde=`/`?hasta=` vayan contra `fromDate`.
 */
const lectura = {
  middlewares: [
    'global::date-range',
    {
      name: 'global::query-defaults',
      config: {
        sort: 'fromDate:desc',
        populate: { staff: { fields: ['username', 'email'] }, room: true },
        atajos: {
          staff: { campo: 'staff', relacionPor: 'documentId' },
          tipo: { campo: 'exceptionKind' },
          motivo: { campo: 'reason' },
          desde: { campo: 'fromDate', operador: '$gte' },
          hasta: { campo: 'fromDate', operador: '$lte' },
        },
      },
    },
  ],
};

export default factories.createCoreRouter('api::scheduling.schedule-exception', {
  config: { find: lectura, findOne: lectura },
});
