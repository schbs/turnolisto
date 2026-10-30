// Fechas en el idioma del paciente y conversión entre hora local de la clínica e ISO en UTC.
import { DateTime } from "luxon";
import type { Idioma } from "@/i18n/idioma";

/** "jueves 5/11 a las 15:00" / "Thursday, Nov 5 at 3:00 PM" */
export function fechaLegible(iso: string, zona: string, idioma: Idioma = "es"): string {
  const fecha = DateTime.fromISO(iso, { zone: zona });
  return idioma === "en" ? fecha.setLocale("en-US").toFormat("cccc, LLL d 'at' h:mm a") : fecha.setLocale("es-AR").toFormat("cccc d/M 'a las' HH:mm");
}

/** Día para las filas de la lista de WhatsApp: "jueves 5/11" / "Thursday, Nov 5" */
export function diaLegible(iso: string, zona: string, idioma: Idioma = "es"): string {
  const fecha = DateTime.fromISO(iso, { zone: zona });
  return idioma === "en" ? fecha.setLocale("en-US").toFormat("cccc, LLL d") : fecha.setLocale("es-AR").toFormat("cccc d/M");
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
