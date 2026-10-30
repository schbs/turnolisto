// Dominio puro de la agenda: sin red, sin base y sin reloj propio (la hora actual entra como parámetro).
// Cada función recibe una Agenda y devuelve una nueva; nunca modifica la que recibe.
import { DateTime } from "luxon";
import type {
  Agenda,
  ConfigAgenda,
  EntradaEspera,
  ErrorAgenda,
  Oferta,
  Prestacion,
  Recordatorio,
  Resultado,
  TipoRecordatorio,
  Turno,
} from "./tipos";

const ACTIVOS = new Set<Turno["estado"]>(["reservado", "confirmado"]);

const ANTICIPACION: [TipoRecordatorio, number][] = [
  ["48h", 48],
  ["24h", 24],
  ["3h", 3],
];

function enZona(iso: string, config: ConfigAgenda): DateTime {
  return DateTime.fromISO(iso, { zone: config.zona });
}

function aIso(fecha: DateTime): string {
  return fecha.toUTC().toISO()!;
}

function seSuperponen(a: { inicio: string; fin: string }, b: { inicio: string; fin: string }): boolean {
  return Date.parse(a.inicio) < Date.parse(b.fin) && Date.parse(b.inicio) < Date.parse(a.fin);
}

/** Apertura y cierre de un día local, o el motivo por el que ese día no se atiende. */
function jornada(dia: DateTime, config: ConfigAgenda): { abre: DateTime; cierra: DateTime } | ErrorAgenda {
  if (config.feriados.includes(dia.toISODate()!)) return "feriado";
  const horario = config.horario[dia.weekday as keyof ConfigAgenda["horario"]];
  if (!horario) return "dia_sin_atencion";
  const hora = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return dia.set({ hour: h, minute: m, second: 0, millisecond: 0 });
  };
  return { abre: hora(horario.abre), cierra: hora(horario.cierra) };
}

/** Valida que un turno [inicio, inicio + duración) entre en el horario de atención, en la grilla y en el futuro. */
export function validarHorario(inicioIso: string, duracionMin: number, config: ConfigAgenda, ahoraIso: string): ErrorAgenda | null {
  const inicio = enZona(inicioIso, config);
  if (Date.parse(inicioIso) <= Date.parse(ahoraIso)) return "en_el_pasado";
  const dia = jornada(inicio.startOf("day"), config);
  if (typeof dia === "string") return dia;
  const fin = inicio.plus({ minutes: duracionMin });
  const minutosDesdeApertura = inicio.diff(dia.abre, "minutes").minutes;
  if (inicio < dia.abre || fin > dia.cierra || minutosDesdeApertura % config.intervaloMin !== 0) return "fuera_de_horario";
  return null;
}

function ocupado(agenda: Agenda, profesionalId: string, inicio: string, fin: string, ignorarId?: string): boolean {
  return agenda.turnos.some(
    (t) => t.id !== ignorarId && t.profesionalId === profesionalId && ACTIVOS.has(t.estado) && seSuperponen(t, { inicio, fin }),
  );
}

/** El paciente ya tiene otro turno activo en ese horario (con cualquier profesional). */
function pacienteOcupado(agenda: Agenda, pacienteId: string, inicio: string, fin: string, ignorarId?: string): boolean {
  return agenda.turnos.some(
    (t) => t.id !== ignorarId && t.pacienteId === pacienteId && ACTIVOS.has(t.estado) && seSuperponen(t, { inicio, fin }),
  );
}

/** Horarios de inicio libres para un profesional y una prestación en una fecha local (YYYY-MM-DD). */
export function slotsDisponibles(
  agenda: Agenda,
  pedido: { fecha: string; profesionalId: string; prestacion: Prestacion },
  config: ConfigAgenda,
  ahoraIso: string,
): string[] {
  const dia = jornada(DateTime.fromISO(pedido.fecha, { zone: config.zona }), config);
  if (typeof dia === "string") return [];
  const slots: string[] = [];
  for (let inicio = dia.abre; inicio.plus({ minutes: pedido.prestacion.duracionMin }) <= dia.cierra; inicio = inicio.plus({ minutes: config.intervaloMin })) {
    const fin = inicio.plus({ minutes: pedido.prestacion.duracionMin });
    if (inicio.toMillis() <= Date.parse(ahoraIso)) continue;
    if (ocupado(agenda, pedido.profesionalId, aIso(inicio), aIso(fin))) continue;
    slots.push(aIso(inicio));
  }
  return slots;
}

export interface PedidoTurno {
  id: string;
  pacienteId: string;
  profesionalId: string;
  prestacion: Prestacion;
  inicio: string;
}

export function reservar(agenda: Agenda, pedido: PedidoTurno, config: ConfigAgenda, ahoraIso: string): Resultado<{ agenda: Agenda; turno: Turno }> {
  const error = validarHorario(pedido.inicio, pedido.prestacion.duracionMin, config, ahoraIso);
  if (error) return { ok: false, error };
  const inicio = aIso(enZona(pedido.inicio, config));
  const fin = aIso(enZona(pedido.inicio, config).plus({ minutes: pedido.prestacion.duracionMin }));
  if (ocupado(agenda, pedido.profesionalId, inicio, fin)) return { ok: false, error: "turno_ocupado" };
  if (pacienteOcupado(agenda, pedido.pacienteId, inicio, fin)) return { ok: false, error: "paciente_ocupado" };
  if (pacienteOcupado(agenda, pedido.pacienteId, inicio, fin)) return { ok: false, error: "paciente_ocupado" };

  const turno: Turno = {
    id: pedido.id,
    pacienteId: pedido.pacienteId,
    profesionalId: pedido.profesionalId,
    prestacionId: pedido.prestacion.id,
    inicio,
    fin,
    estado: "reservado",
    creadoEn: ahoraIso,
  };
  return { ok: true, agenda: { ...agenda, turnos: [...agenda.turnos, turno] }, turno };
}

function turnoActivo(agenda: Agenda, turnoId: string): Turno | ErrorAgenda {
  const turno = agenda.turnos.find((t) => t.id === turnoId);
  if (!turno) return "turno_inexistente";
  if (!ACTIVOS.has(turno.estado)) return "turno_no_activo";
  return turno;
}

function reemplazar(agenda: Agenda, turno: Turno): Agenda {
  return { ...agenda, turnos: agenda.turnos.map((t) => (t.id === turno.id ? turno : t)) };
}

/** El paciente confirma que viene (botón del recordatorio). Confirmar dos veces no es un error. */
export function confirmar(agenda: Agenda, turnoId: string): Resultado<{ agenda: Agenda; turno: Turno }> {
  const actual = turnoActivo(agenda, turnoId);
  if (typeof actual === "string") return { ok: false, error: actual };
  const turno: Turno = { ...actual, estado: "confirmado" };
  return { ok: true, agenda: reemplazar(agenda, turno), turno };
}

/** Mueve un turno a otro horario con la misma duración. Al moverlo vuelve a "reservado" (hay que reconfirmarlo). */
export function reprogramar(
  agenda: Agenda,
  turnoId: string,
  nuevoInicio: string,
  config: ConfigAgenda,
  ahoraIso: string,
): Resultado<{ agenda: Agenda; turno: Turno }> {
  const actual = turnoActivo(agenda, turnoId);
  if (typeof actual === "string") return { ok: false, error: actual };
  const duracionMin = (Date.parse(actual.fin) - Date.parse(actual.inicio)) / 60_000;
  const error = validarHorario(nuevoInicio, duracionMin, config, ahoraIso);
  if (error) return { ok: false, error };
  const inicio = aIso(enZona(nuevoInicio, config));
  const fin = aIso(enZona(nuevoInicio, config).plus({ minutes: duracionMin }));
  if (ocupado(agenda, actual.profesionalId, inicio, fin, actual.id)) return { ok: false, error: "turno_ocupado" };
  if (pacienteOcupado(agenda, actual.pacienteId, inicio, fin, actual.id)) return { ok: false, error: "paciente_ocupado" };
  if (pacienteOcupado(agenda, actual.pacienteId, inicio, fin, actual.id)) return { ok: false, error: "paciente_ocupado" };

  const turno: Turno = { ...actual, inicio, fin, estado: "reservado" };
  return { ok: true, agenda: reemplazar(agenda, turno), turno };
}

/**
 * Primera entrada de la lista de espera (por orden de llegada) a la que le sirve un hueco:
 * sigue esperando, la fecha está en su rango, el profesional coincide (o le da igual) y su prestación entra en el hueco.
 */
export function elegirDeListaEspera(
  listaEspera: EntradaEspera[],
  hueco: { profesionalId: string; inicio: string; fin: string },
  prestaciones: Prestacion[],
  config: ConfigAgenda,
): EntradaEspera | null {
  const fecha = enZona(hueco.inicio, config).toISODate()!;
  const minutosHueco = (Date.parse(hueco.fin) - Date.parse(hueco.inicio)) / 60_000;
  const duracion = new Map(prestaciones.map((p) => [p.id, p.duracionMin]));
  const candidatas = listaEspera
    .filter((e) => e.estado === "esperando")
    .filter((e) => e.desde <= fecha && fecha <= e.hasta)
    .filter((e) => !e.profesionalId || e.profesionalId === hueco.profesionalId)
    .filter((e) => (duracion.get(e.prestacionId) ?? Infinity) <= minutosHueco)
    .sort((a, b) => Date.parse(a.creadoEn) - Date.parse(b.creadoEn));
  return candidatas[0] ?? null;
}

/** Cancela un turno y, si el horario todavía no pasó, se lo ofrece al primero de la lista de espera que pueda. */
export function cancelar(
  agenda: Agenda,
  turnoId: string,
  prestaciones: Prestacion[],
  config: ConfigAgenda,
  ahoraIso: string,
): Resultado<{ agenda: Agenda; turno: Turno; oferta: Oferta | null }> {
  const actual = turnoActivo(agenda, turnoId);
  if (typeof actual === "string") return { ok: false, error: actual };
  const turno: Turno = { ...actual, estado: "cancelado" };
  let nueva = reemplazar(agenda, turno);

  const elegida = Date.parse(turno.inicio) > Date.parse(ahoraIso) ? elegirDeListaEspera(nueva.listaEspera, turno, prestaciones, config) : null;
  if (!elegida) return { ok: true, agenda: nueva, turno, oferta: null };

  nueva = { ...nueva, listaEspera: nueva.listaEspera.map((e) => (e.id === elegida.id ? { ...e, estado: "ofrecido" } : e)) };
  const oferta: Oferta = {
    entradaId: elegida.id,
    pacienteId: elegida.pacienteId,
    profesionalId: turno.profesionalId,
    prestacionId: elegida.prestacionId,
    inicio: turno.inicio,
  };
  return { ok: true, agenda: nueva, turno, oferta };
}

/**
 * Qué recordatorios tiene que mandar el job en este momento. Uno vence cuando llegó su hora, el turno sigue activo y
 * no empezó, todavía no se mandó, y su hora es posterior a la reserva (no hay "48 h antes" de un turno sacado ayer).
 * Si vencieron varios del mismo turno (el job estuvo caído), se manda solo el más cercano al turno y el resto se saltea.
 */
export function recordatoriosPendientes(
  turnos: Turno[],
  enviados: Record<string, TipoRecordatorio[]>,
  ahoraIso: string,
): { enviar: { turnoId: string; tipo: TipoRecordatorio }[]; saltear: { turnoId: string; tipo: TipoRecordatorio }[] } {
  const ahora = Date.parse(ahoraIso);
  const enviar: { turnoId: string; tipo: TipoRecordatorio }[] = [];
  const saltear: { turnoId: string; tipo: TipoRecordatorio }[] = [];
  for (const t of turnos) {
    if (!ACTIVOS.has(t.estado) || Date.parse(t.inicio) <= ahora) continue;
    const vencidos = calcularRecordatorios(t, t.creadoEn)
      .filter((r) => Date.parse(r.enviarEn) <= ahora && !(enviados[t.id] ?? []).includes(r.tipo))
      .map((r) => r.tipo);
    if (!vencidos.length) continue;
    // calcularRecordatorios los devuelve de 48 h a 3 h: el último es el más cercano al turno.
    enviar.push({ turnoId: t.id, tipo: vencidos.at(-1)! });
    saltear.push(...vencidos.slice(0, -1).map((tipo) => ({ turnoId: t.id, tipo })));
  }
  return { enviar, saltear };
}

/** Recordatorios a 48 h, 24 h y 3 h del turno. Solo los que todavía no pasaron, y nunca para turnos inactivos. */
export function calcularRecordatorios(turno: Turno, ahoraIso: string): Recordatorio[] {
  if (!ACTIVOS.has(turno.estado)) return [];
  const inicio = DateTime.fromISO(turno.inicio, { zone: "utc" });
  return ANTICIPACION.map(([tipo, horas]) => ({ turnoId: turno.id, tipo, enviarEn: aIso(inicio.minus({ hours: horas })) })).filter(
    (r) => Date.parse(r.enviarEn) > Date.parse(ahoraIso),
  );
}
