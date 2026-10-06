import { diaEnZona, diaSiguiente, ms } from './tiempo';

/**
 * Días de estancia facturables (5.6, H4).
 *
 * Un día de estancia es un día calendario iniciado en la zona de la clínica:
 * del día del ingreso al del alta (o al de hoy, si sigue ingresada), ambos
 * incluidos. Cada día se cobra con la jaula que ocupaba al final de ese día, o
 * al alta si es el último: es la del último tramo (`cageStays`) que empezó ese
 * día o antes.
 *
 * La clave del día (`<documentId>:<AAAA-MM-DD>`) es la identidad del concepto
 * en la factura (`invoice-item.sourceLineKey`/`lockKey`, máximo 36): no puede
 * depender de nada que cambie salvo la fecha.
 */

export type Tramo = { cage?: { documentId?: string } | null; fromAt: string; toAt?: string | null };

export type DiaDeEstancia = { fecha: string; lineKey: string; cageId: string | null };

export const claveDeDia = (hospitalizacionId: string, fecha: string): string => `${hospitalizacionId}:${fecha}`;

export function diasDeEstancia(
  h: { documentId: string; admittedAt: string; dischargedAt?: string | null; cageStays?: Tramo[] | null; cage?: { documentId?: string } | null },
  zona: string,
  ahora: Date = new Date()
): DiaDeEstancia[] {
  if (!h.admittedAt) return [];
  const desde = diaEnZona(h.admittedAt, zona);
  const fin = h.dischargedAt ? new Date(h.dischargedAt) : ahora;
  const hasta = diaEnZona(fin, zona);
  if (hasta < desde) return [];

  // Tramos por inicio. Sin tramos (datos anteriores o escritos a mano), la jaula actual.
  const tramos = [...(h.cageStays ?? [])]
    .filter((t) => ms(t.fromAt) !== null)
    .sort((a, b) => (ms(a.fromAt) as number) - (ms(b.fromAt) as number))
    .map((t) => ({ dia: diaEnZona(t.fromAt, zona), cageId: t.cage?.documentId ?? null }));

  const dias: DiaDeEstancia[] = [];
  // Tope de seguridad: un ingreso con la fecha mal escrita no genera años de días.
  for (let dia = desde, n = 0; dia <= hasta && n < 3660; dia = diaSiguiente(dia), n++) {
    let cageId: string | null = h.cage?.documentId ?? null;
    if (tramos.length > 0) {
      const vigentes = tramos.filter((t) => t.dia <= dia);
      cageId = (vigentes.length > 0 ? vigentes[vigentes.length - 1] : tramos[0]).cageId;
    }
    dias.push({ fecha: dia, lineKey: claveDeDia(h.documentId, dia), cageId });
  }
  return dias;
}

/**
 * Cada día con su jaula y el servicio con que se cobra: el `dailyService` de
 * esa jaula o, si no tiene, el de Clínica. `h` trae `cage` y `cageStays.cage`
 * con `dailyService` poblado. Lo usan la facturación y la regla que impide que
 * un cambio en la hospitalización altere un día ya cobrado, para que las dos
 * calculen exactamente lo mismo.
 */
export function diasConServicio(
  h: Parameters<typeof diasDeEstancia>[0] & { cage?: any; cageStays?: any[] | null },
  zona: string,
  porDefecto: any | null,
  ahora: Date = new Date()
): Array<DiaDeEstancia & { jaula: any | null; servicio: any | null }> {
  const jaulas = new Map<string, any>();
  for (const c of [h.cage, ...(h.cageStays ?? []).map((t: any) => t?.cage)]) {
    if (c?.documentId) jaulas.set(c.documentId, c);
  }
  return diasDeEstancia(h, zona, ahora).map((d) => {
    const jaula = d.cageId ? jaulas.get(d.cageId) ?? null : null;
    return { ...d, jaula, servicio: jaula?.dailyService ?? porDefecto ?? null };
  });
}
