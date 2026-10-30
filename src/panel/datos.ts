// Consultas del panel. Usan el cliente con sesión: si el usuario no es staff, RLS devuelve todo vacío.
import { DateTime } from "luxon";
import { configAgenda } from "@/config/clinica";
import type { EstadoTurno } from "@/domain/tipos";
import type { supabaseSesion } from "./supabase-sesion";

type Cliente = Awaited<ReturnType<typeof supabaseSesion>>;
const zona = configAgenda.zona;

export interface TurnoPanel {
  id: string;
  inicio: string;
  estado: EstadoTurno;
  paciente: string;
  profesional: string;
  prestacionId: string;
  prestacion: string;
}

export interface DerivacionPanel {
  id: number;
  telefono: string;
  motivo: string;
  resumen: string;
  creadoEn: string;
  paciente: string | null;
  ultimoMensaje: string | null;
}

/** Lunes de la semana pedida (?semana=YYYY-MM-DD) o de la actual, en hora de la clínica. */
export function lunesDe(semana: string | undefined, ahora = DateTime.now()): DateTime {
  const base = semana && DateTime.fromISO(semana, { zone: zona }).isValid ? DateTime.fromISO(semana, { zone: zona }) : ahora.setZone(zona);
  return base.startOf("day").minus({ days: base.weekday - 1 });
}

const nombre = (x: unknown) => (x as { nombre?: string } | null)?.nombre ?? "—";

export async function cargarPanel(db: Cliente, lunes: DateTime) {
  const ahora = DateTime.now();
  const desde = lunes.toUTC().toISO()!;
  const hasta = lunes.plus({ days: 7 }).toUTC().toISO()!;

  const [semana, proximos, cancelados, recuperados, pendientes, derivadas7] = await Promise.all([
    db
      .from("turnos")
      .select("id, inicio, estado, pacientes(nombre), profesionales(nombre), prestaciones(id, nombre)")
      .gte("inicio", desde)
      .lt("inicio", hasta)
      .order("inicio"),
    db
      .from("turnos")
      .select("estado")
      .gte("inicio", ahora.toUTC().toISO()!)
      .lt("inicio", ahora.plus({ days: 7 }).toUTC().toISO()!)
      .in("estado", ["reservado", "confirmado"]),
    db.from("turnos").select("id", { count: "exact", head: true }).eq("estado", "cancelado"),
    db.from("lista_espera").select("id", { count: "exact", head: true }).eq("estado", "asignado"),
    db.from("handoffs").select("id, telefono, motivo, resumen, creado_en, pacientes(nombre)").neq("estado", "resuelto").order("creado_en"),
    db.from("handoffs").select("id", { count: "exact", head: true }).gte("creado_en", ahora.minus({ days: 7 }).toUTC().toISO()!),
  ]);
  for (const r of [semana, proximos, cancelados, recuperados, pendientes, derivadas7]) if (r.error) throw new Error(r.error.message);

  const telefonos = (pendientes.data ?? []).map((h) => h.telefono as string);
  const mensajes = telefonos.length
    ? ((await db.from("mensajes").select("telefono, texto, creado_en").in("telefono", telefonos).eq("direccion", "entrante").order("creado_en", { ascending: false })).data ?? [])
    : [];

  const turnos: TurnoPanel[] = (semana.data ?? []).map((t) => ({
    id: t.id as string,
    inicio: t.inicio as string,
    estado: t.estado as EstadoTurno,
    paciente: nombre(t.pacientes),
    profesional: nombre(t.profesionales),
    prestacionId: (t.prestaciones as { id?: string } | null)?.id ?? "",
    prestacion: nombre(t.prestaciones),
  }));

  const activos = proximos.data ?? [];
  const confirmados = activos.filter((t) => t.estado === "confirmado").length;

  return {
    turnos,
    kpis: {
      confirmacion: { confirmados, total: activos.length },
      recuperadas: { recuperadas: recuperados.count ?? 0, canceladas: cancelados.count ?? 0 },
      derivaciones: { pendientes: (pendientes.data ?? []).length, ultimos7: derivadas7.count ?? 0 },
      semana: turnos.filter((t) => t.estado !== "cancelado").length,
    },
    derivaciones: (pendientes.data ?? []).map(
      (h): DerivacionPanel => ({
        id: h.id as number,
        telefono: h.telefono as string,
        motivo: h.motivo as string,
        resumen: h.resumen as string,
        creadoEn: h.creado_en as string,
        paciente: (h.pacientes as { nombre?: string } | null)?.nombre ?? null,
        ultimoMensaje: (mensajes.find((m) => m.telefono === h.telefono)?.texto as string | undefined) ?? null,
      }),
    ),
  };
}
