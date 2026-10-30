// Fechas en el idioma del paciente y conversión entre hora local de la clínica e ISO en UTC.
import { DateTime } from "luxon";

/** "jueves 5/11 a las 15:00" */
export function fechaLegible(iso: string, zona: string): string {
  return DateTime.fromISO(iso, { zone: zona }).setLocale("es-AR").toFormat("cccc d/M 'a las' HH:mm");
}

/** "2026-11-05T15:00" (hora local, sin zona): el formato que usa el agente. */
export function aLocal(iso: string, zona: string): string {
  return DateTime.fromISO(iso, { zone: zona }).toFormat("yyyy-MM-dd'T'HH:mm");
}

/** De "2026-11-05T15:00" en hora local a ISO en UTC. null si el texto no es una fecha y hora válida. */
export function desdeLocal(local: string, zona: string): string | null {
  const fecha = DateTime.fromFormat(local, "yyyy-MM-dd'T'HH:mm", { zone: zona });
  return fecha.isValid ? fecha.toUTC().toISO() : null;
}
