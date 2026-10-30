// Repositorio sobre Supabase (Postgres) con la misma interfaz que RepositorioMemoria. Usa la clave de servicio:
// corre solo en el servidor (webhook y jobs). La restricción "exclude" de la tabla turnos es la última barrera
// contra la doble reserva si dos mensajes llegan a la vez.
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agenda, EntradaEspera, Oferta, Prestacion, Profesional, TipoRecordatorio, Turno } from "@/domain/tipos";
import type { EstadoConversacion, Handoff, Paciente, RegistroMensaje, Repositorio } from "./repositorio";
import { supabaseServicio } from "./supabase";

type Fila = Record<string, unknown>;

const COLUMNA_RECORDATORIO: Record<TipoRecordatorio, string> = { "48h": "enviado_48", "24h": "enviado_24", "3h": "enviado_3" };

const aTurno = (f: Fila): Turno => ({
  id: f.id as string,
  pacienteId: f.paciente_id as string,
  profesionalId: f.profesional_id as string,
  prestacionId: f.prestacion_id as string,
  inicio: new Date(f.inicio as string).toISOString(),
  fin: new Date(f.fin as string).toISOString(),
  estado: f.estado as Turno["estado"],
  creadoEn: new Date(f.creado_en as string).toISOString(),
});
const deTurno = (t: Turno) => ({
  id: t.id,
  paciente_id: t.pacienteId,
  profesional_id: t.profesionalId,
  prestacion_id: t.prestacionId,
  inicio: t.inicio,
  fin: t.fin,
  estado: t.estado,
  creado_en: t.creadoEn,
});
const aEntrada = (f: Fila): EntradaEspera => ({
  id: f.id as string,
  pacienteId: f.paciente_id as string,
  prestacionId: f.prestacion_id as string,
  ...(f.profesional_id ? { profesionalId: f.profesional_id as string } : {}),
  desde: f.desde as string,
  hasta: f.hasta as string,
  creadoEn: new Date(f.creado_en as string).toISOString(),
  estado: f.estado as EntradaEspera["estado"],
});
const deEntrada = (e: EntradaEspera) => ({
  id: e.id,
  paciente_id: e.pacienteId,
  prestacion_id: e.prestacionId,
  profesional_id: e.profesionalId ?? null,
  desde: e.desde,
  hasta: e.hasta,
  estado: e.estado,
  creado_en: e.creadoEn,
});
const aPaciente = (f: Fila): Paciente => ({
  id: f.id as string,
  nombre: f.nombre as string,
  telefono: f.telefono as string,
  ...(f.email ? { email: f.email as string } : {}),
  ...(f.obra_social ? { obraSocial: f.obra_social as string } : {}),
  optInWhatsapp: f.opt_in_whatsapp as boolean,
});

function chequear<T>(r: { data: T; error: { message: string } | null }, que: string): T {
  if (r.error) throw new Error(`Supabase (${que}): ${r.error.message}`);
  return r.data;
}

/** Para consultas que devuelven varias filas: nunca null. */
function filas(r: { data: unknown; error: { message: string } | null }, que: string): Fila[] {
  return (chequear(r, que) ?? []) as Fila[];
}

export class RepositorioSupabase implements Repositorio {
  private constructor(
    private db: SupabaseClient,
    private _prestaciones: Prestacion[],
    private _profesionales: Profesional[],
  ) {}

  /** Carga el catálogo (prestaciones y profesionales) una vez: cambia muy poco. */
  static async crear(db: SupabaseClient = supabaseServicio()): Promise<RepositorioSupabase> {
    const prestaciones = chequear(await db.from("prestaciones").select("id, nombre, duracion_min").order("id"), "prestaciones") as Fila[];
    const profesionales = chequear(await db.from("profesionales").select("id, nombre, profesional_prestaciones(prestacion_id)").order("id"), "profesionales") as Fila[];
    return new RepositorioSupabase(
      db,
      prestaciones.map((p) => ({ id: p.id as string, nombre: p.nombre as string, duracionMin: p.duracion_min as number })),
      profesionales.map((p) => ({
        id: p.id as string,
        nombre: p.nombre as string,
        prestaciones: (p.profesional_prestaciones as { prestacion_id: string }[]).map((x) => x.prestacion_id),
      })),
    );
  }

  prestaciones() {
    return this._prestaciones;
  }
  profesionales() {
    return this._profesionales;
  }

  async pacientePorTelefono(telefono: string) {
    const fila = chequear(await this.db.from("pacientes").select("*").eq("telefono", telefono).maybeSingle(), "paciente por teléfono");
    return fila ? aPaciente(fila) : null;
  }
  async paciente(id: string) {
    const fila = chequear(await this.db.from("pacientes").select("*").eq("id", id).maybeSingle(), "paciente");
    return fila ? aPaciente(fila) : null;
  }
  async crearPaciente(datos: Omit<Paciente, "id">) {
    const id = await this.nuevoId("pac");
    const fila = chequear(
      await this.db
        .from("pacientes")
        .insert({ id, nombre: datos.nombre, telefono: datos.telefono, email: datos.email ?? null, obra_social: datos.obraSocial ?? null, opt_in_whatsapp: datos.optInWhatsapp })
        .select()
        .single(),
      "crear paciente",
    );
    return aPaciente(fila);
  }

  async agenda(): Promise<Agenda> {
    // Para la demo alcanza con traer todo; con miles de turnos se filtraría por ventana de fechas.
    const [turnos, espera] = await Promise.all([this.db.from("turnos").select("*").order("inicio"), this.db.from("lista_espera").select("*").order("creado_en")]);
    return { turnos: filas(turnos, "turnos").map(aTurno), listaEspera: filas(espera, "lista de espera").map(aEntrada) };
  }

  /** Guarda solo lo que cambió respecto de la base (las funciones del dominio devuelven la agenda entera). */
  async guardarAgenda(nueva: Agenda) {
    const actual = await this.agenda();
    const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const turnosAntes = new Map(actual.turnos.map((t) => [t.id, t]));
    const esperaAntes = new Map(actual.listaEspera.map((e) => [e.id, e]));
    const turnos = nueva.turnos.filter((t) => !igual(turnosAntes.get(t.id), t)).map(deTurno);
    const espera = nueva.listaEspera.filter((e) => !igual(esperaAntes.get(e.id), e)).map(deEntrada);
    if (turnos.length) chequear(await this.db.from("turnos").upsert(turnos), "guardar turnos");
    if (espera.length) chequear(await this.db.from("lista_espera").upsert(espera), "guardar lista de espera");
  }

  async eventoDeTurno(turnoId: string) {
    const fila = chequear(await this.db.from("turnos").select("calendar_event_id").eq("id", turnoId).maybeSingle(), "evento del turno");
    return (fila?.calendar_event_id as string | null) ?? null;
  }
  async guardarEventoDeTurno(turnoId: string, eventoId: string) {
    chequear(await this.db.from("turnos").update({ calendar_event_id: eventoId }).eq("id", turnoId), "guardar evento");
  }

  async marcarMensajeProcesado(mensajeId: string) {
    const r = await this.db.from("mensajes_procesados").insert({ id: mensajeId });
    if (r.error?.code === "23505") return false; // clave duplicada: ya se procesó
    chequear(r, "marcar mensaje");
    return true;
  }

  async conversacion(telefono: string): Promise<EstadoConversacion> {
    const fila = chequear(await this.db.from("conversaciones").select("*").eq("telefono", telefono).maybeSingle(), "conversación");
    if (!fila) return { telefono, historial: [], fallos: 0, pausado: false };
    return {
      telefono,
      historial: fila.historial as EstadoConversacion["historial"],
      fallos: fila.fallos as number,
      pausado: fila.pausado as boolean,
      ...(fila.reprogramando ? { reprogramando: fila.reprogramando as string } : {}),
      ...(fila.idioma ? { idioma: fila.idioma as EstadoConversacion["idioma"] } : {}),
    };
  }
  async guardarConversacion(e: EstadoConversacion) {
    chequear(
      await this.db.from("conversaciones").upsert({
        telefono: e.telefono,
        historial: e.historial,
        fallos: e.fallos,
        pausado: e.pausado,
        reprogramando: e.reprogramando ?? null,
        idioma: e.idioma ?? null,
        actualizado_en: new Date().toISOString(),
      }),
      "guardar conversación",
    );
  }

  async registrarHandoff(datos: Omit<Handoff, "id" | "estado">) {
    const fila = chequear(
      await this.db
        .from("handoffs")
        .insert({ telefono: datos.telefono, paciente_id: datos.pacienteId ?? null, motivo: datos.motivo, resumen: datos.resumen, creado_en: datos.creadoEn })
        .select()
        .single(),
      "registrar derivación",
    );
    return { ...datos, id: String(fila.id), estado: "pendiente" as const };
  }
  async handoffs() {
    return filas(await this.db.from("handoffs").select("*").order("creado_en"), "derivaciones").map((f) => ({
      id: String(f.id),
      telefono: f.telefono as string,
      ...(f.paciente_id ? { pacienteId: f.paciente_id as string } : {}),
      motivo: f.motivo as Handoff["motivo"],
      resumen: f.resumen as string,
      estado: f.estado as Handoff["estado"],
      creadoEn: new Date(f.creado_en as string).toISOString(),
    }));
  }

  async guardarOferta(o: Oferta) {
    chequear(
      await this.db
        .from("ofertas")
        .upsert({ entrada_id: o.entradaId, paciente_id: o.pacienteId, profesional_id: o.profesionalId, prestacion_id: o.prestacionId, inicio: o.inicio }),
      "guardar oferta",
    );
  }
  async oferta(entradaId: string) {
    const f = chequear(await this.db.from("ofertas").select("*").eq("entrada_id", entradaId).maybeSingle(), "oferta");
    if (!f) return null;
    return {
      entradaId,
      pacienteId: f.paciente_id as string,
      profesionalId: f.profesional_id as string,
      prestacionId: f.prestacion_id as string,
      inicio: new Date(f.inicio as string).toISOString(),
    };
  }

  async registrarMensaje(m: RegistroMensaje) {
    const paciente = await this.pacientePorTelefono(m.telefono);
    chequear(
      await this.db.from("mensajes").insert({
        telefono: m.telefono,
        paciente_id: paciente?.id ?? null,
        direccion: m.direccion,
        tipo: m.tipo,
        texto: m.texto,
        creado_en: m.creadoEn,
      }),
      "registrar mensaje",
    );
  }
  async mensajes(telefono?: string) {
    let q = this.db.from("mensajes").select("*").order("creado_en");
    if (telefono) q = q.eq("telefono", telefono);
    return filas(await q, "mensajes").map((f) => ({
      telefono: f.telefono as string,
      direccion: f.direccion as RegistroMensaje["direccion"],
      tipo: f.tipo as string,
      texto: (f.texto as string) ?? "",
      creadoEn: new Date(f.creado_en as string).toISOString(),
    }));
  }

  async nuevoId(tipo: "tur" | "esp" | "pac") {
    // Aleatorio: con varias instancias atendiendo a la vez, un contador podría repetirse.
    return `${tipo}-${crypto.randomBytes(4).toString("hex")}`;
  }

  async recordatoriosEnviados(turnoIds: string[]) {
    if (!turnoIds.length) return {};
    const enviados = filas(await this.db.from("turnos").select("id, enviado_48, enviado_24, enviado_3").in("id", turnoIds), "recordatorios");
    return Object.fromEntries(
      enviados.map((f) => [f.id as string, (Object.keys(COLUMNA_RECORDATORIO) as TipoRecordatorio[]).filter((t) => f[COLUMNA_RECORDATORIO[t]])]),
    );
  }
  async marcarRecordatorio(turnoId: string, tipo: TipoRecordatorio, cuando: string) {
    // Solo si estaba vacío: dos corridas del job a la vez no marcan (ni mandan) dos veces.
    const marcadas = filas(
      await this.db.from("turnos").update({ [COLUMNA_RECORDATORIO[tipo]]: cuando }).eq("id", turnoId).is(COLUMNA_RECORDATORIO[tipo], null).select("id"),
      "marcar recordatorio",
    );
    return marcadas.length > 0;
  }
  async liberarRecordatorio(turnoId: string, tipo: TipoRecordatorio) {
    chequear(await this.db.from("turnos").update({ [COLUMNA_RECORDATORIO[tipo]]: null }).eq("id", turnoId), "liberar recordatorio");
  }
}
