// Herramientas del agente: esquema Zod (lo que ve el modelo) + ejecución contra el dominio, la base y el calendario.
// El modelo nunca toca datos directo: todo pasa por acá y por las reglas de src/domain/agenda.ts.
import { DateTime } from "luxon";
import { z } from "zod";
import clinica from "../../data/clinica.json";
import type { Calendario } from "@/calendario/calendario";
import type { MotivoHandoff, Paciente, Repositorio } from "@/datos/repositorio";
import { cancelar, reprogramar, reservar, slotsDisponibles } from "@/domain/agenda";
import { aLocal, desdeLocal, fechaLegible } from "@/domain/formato";
import type { ConfigAgenda, ErrorAgenda, Prestacion, Profesional, Turno } from "@/domain/tipos";
import type { Interactivo, Mensajero } from "@/whatsapp/mensajero";
import type { DeclaracionHerramienta } from "./modelo";

export interface DepsHerramientas {
  repo: Repositorio;
  calendario: Calendario;
  mensajero: Mensajero;
  config: ConfigAgenda;
  ahora: () => string;
}

export type TemaRespuesta = "turnos" | "info" | "fuera_de_tema" | "saludo" | "otro";

export interface Respuesta {
  texto: string;
  entendio: boolean;
  tema: TemaRespuesta;
}

/** Lo que pasa durante un mensaje: el agente lo va llenando y el bot lo usa al final. */
export interface ContextoHerramientas {
  deps: DepsHerramientas;
  /** E.164 (+549…) */
  telefono: string;
  paciente: Paciente | null;
  herramientasUsadas: string[];
  sugerencia?: Interactivo;
  handoff?: { motivo: MotivoHandoff; resumen: string };
  reprogramado?: boolean;
}

const MENSAJES_ERROR: Record<ErrorAgenda, string> = {
  turno_ocupado: "Ese horario ya está ocupado.",
  paciente_ocupado: "La persona ya tiene un turno en ese horario (mirá \"Turnos del paciente\"): no se reserva otro encima.",
  fuera_de_horario: "Ese horario está fuera del horario de atención o no coincide con la grilla de turnos.",
  dia_sin_atencion: "Ese día la clínica no atiende.",
  feriado: "Ese día es feriado y la clínica está cerrada.",
  en_el_pasado: "Ese horario ya pasó.",
  turno_inexistente: "No encuentro ese turno.",
  turno_no_activo: "Ese turno ya estaba cancelado.",
};

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD");
const horaLocalSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Formato YYYY-MM-DDTHH:mm");

function esquemas(prestaciones: Prestacion[], profesionales: Profesional[]) {
  const prestacionId = z.enum(prestaciones.map((p) => p.id) as [string, ...string[]]);
  const profesionalId = z.enum(profesionales.map((p) => p.id) as [string, ...string[]]);
  const nombre = z.string().min(3).max(80).describe("Nombre y apellido, solo si el paciente es desconocido");

  return {
    buscar_slots: {
      descripcion: "Busca horarios libres para una prestación en un día. Usala antes de ofrecer horarios.",
      args: z.object({
        prestacion_id: prestacionId,
        fecha: fechaSchema.describe("Día pedido, YYYY-MM-DD"),
        profesional_id: profesionalId.optional().describe("Solo si la persona pidió un profesional, o para reprogramar"),
        franja: z.enum(["manana", "tarde", "cualquiera"]).optional().describe("mañana = antes de las 13"),
        hora_preferida: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .optional()
          .describe("HH:mm si la persona pidió una hora: trae primero los horarios más cercanos"),
      }),
    },
    reservar_turno: {
      descripcion: "Reserva un turno en un horario que la persona eligió (salido de buscar_slots).",
      args: z.object({
        prestacion_id: prestacionId,
        profesional_id: profesionalId,
        inicio: horaLocalSchema.describe("Fecha y hora local, YYYY-MM-DDTHH:mm"),
        nombre_paciente: nombre.optional(),
      }),
    },
    reprogramar_turno: {
      descripcion: "Mueve un turno del paciente a otro horario libre (misma prestación y profesional).",
      args: z.object({ turno_id: z.string(), nuevo_inicio: horaLocalSchema.describe("Fecha y hora local, YYYY-MM-DDTHH:mm") }),
    },
    cancelar_turno: {
      descripcion: "Cancela un turno del paciente. El horario se ofrece solo a la lista de espera.",
      args: z.object({ turno_id: z.string() }),
    },
    info_clinica: {
      descripcion: "Datos de la clínica. Única fuente para direcciones, horarios, coberturas, precios y teléfonos.",
      args: z.object({
        tema: z.enum(["direccion", "horarios", "obras_sociales", "precios", "medios_de_pago", "politicas", "preparacion", "contacto"]),
      }),
    },
    anotar_lista_espera: {
      descripcion: "Anota a la persona en la lista de espera: si se libera un turno compatible, se lo ofrecemos por WhatsApp.",
      args: z.object({
        prestacion_id: prestacionId,
        desde: fechaSchema,
        hasta: fechaSchema,
        profesional_id: profesionalId.optional(),
        nombre_paciente: nombre.optional(),
      }),
    },
    derivar_a_recepcion: {
      descripcion: "Pasa la conversación a una persona de recepción. Después de esto el asistente deja de responder.",
      args: z.object({
        motivo: z.enum(["pedido_del_paciente", "queja", "urgencia", "no_entiendo", "otro"]),
        resumen: z.string().min(3).max(300).describe("Qué necesita la persona, en una oración, para recepción"),
      }),
    },
    responder: {
      descripcion: "Mensaje final para la persona. Siempre es la última herramienta.",
      args: z.object({
        texto: z.string().min(1).max(600).describe("Máximo 3 oraciones"),
        entendio: z.boolean(),
        tema: z.enum(["turnos", "info", "fuera_de_tema", "saludo", "otro"]),
      }),
    },
  };
}

export type NombreHerramienta = keyof ReturnType<typeof esquemas>;

export function declaraciones(repo: Repositorio): DeclaracionHerramienta[] {
  return Object.entries(esquemas(repo.prestaciones(), repo.profesionales())).map(([name, h]) => {
    const schema = z.toJSONSchema(h.args) as Record<string, unknown>;
    delete schema.$schema;
    return { name, description: h.descripcion, parametersJsonSchema: schema };
  });
}

export function validarArgs(repo: Repositorio, nombre: string, args: unknown) {
  const h = esquemas(repo.prestaciones(), repo.profesionales())[nombre as NombreHerramienta];
  if (!h) return { ok: false as const, error: `No existe la herramienta ${nombre}` };
  const r = h.args.safeParse(args ?? {});
  return r.success ? { ok: true as const, args: r.data } : { ok: false as const, error: z.prettifyError(r.error) };
}

// ---------- Ejecución ----------

const ACTIVO = (t: Turno) => t.estado === "reservado" || t.estado === "confirmado";

function nombreDe(lista: { id: string; nombre: string }[], id: string) {
  return lista.find((x) => x.id === id)?.nombre ?? id;
}

function describirTurno(t: Turno, ctx: ContextoHerramientas) {
  return {
    id: t.id,
    prestacion: nombreDe(ctx.deps.repo.prestaciones(), t.prestacionId),
    profesional: nombreDe(ctx.deps.repo.profesionales(), t.profesionalId),
    cuando: fechaLegible(t.inicio, ctx.deps.config.zona),
    inicio: aLocal(t.inicio, ctx.deps.config.zona),
  };
}

async function asegurarPaciente(ctx: ContextoHerramientas, nombre?: string): Promise<Paciente | null> {
  if (ctx.paciente) return ctx.paciente;
  if (!nombre) return null;
  ctx.paciente = await ctx.deps.repo.crearPaciente({ nombre: nombre.trim(), telefono: ctx.telefono, optInWhatsapp: true });
  return ctx.paciente;
}

async function turnoDelPaciente(ctx: ContextoHerramientas, turnoId: string) {
  const agenda = await ctx.deps.repo.agenda();
  const turno = agenda.turnos.find((t) => t.id === turnoId);
  if (!turno || !ctx.paciente || turno.pacienteId !== ctx.paciente.id) return { agenda, turno: null };
  return { agenda, turno };
}

function opcionesDelDia(
  ctx: ContextoHerramientas,
  agenda: Awaited<ReturnType<Repositorio["agenda"]>>,
  a: { prestacion: Prestacion; fecha: string; profesionales: Profesional[]; franja: string; horaPreferida?: string },
) {
  const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const cercania = (h: string) => (a.horaPreferida ? Math.abs(minutos(h) - minutos(a.horaPreferida)) : 0);
  const { config } = ctx.deps;
  return a.profesionales
    .map((prof) => {
      const horarios = slotsDisponibles(agenda, { fecha: a.fecha, profesionalId: prof.id, prestacion: a.prestacion }, config, ctx.deps.ahora())
        .map((iso) => DateTime.fromISO(iso, { zone: config.zona }))
        // Se ofrecen en punto y y media; la grilla de 15 minutos queda para reprogramar a mano.
        .filter((d) => d.minute % 30 === 0)
        .filter((d) => (a.franja === "manana" ? d.hour < 13 : a.franja === "tarde" ? d.hour >= 13 : true))
        .map((d) => d.toFormat("HH:mm"));
      const elegidos = [...horarios].sort((x, y) => cercania(x) - cercania(y)).slice(0, 4).sort();
      return { profesional_id: prof.id, profesional: prof.nombre, horarios: elegidos };
    })
    .filter((o) => o.horarios.length > 0);
}

type Ejecutor = (args: never, ctx: ContextoHerramientas) => Promise<Record<string, unknown>>;

const ejecutores: Record<Exclude<NombreHerramienta, "responder">, Ejecutor> = {
  async buscar_slots(a: { prestacion_id: string; fecha: string; profesional_id?: string; franja?: string; hora_preferida?: string }, ctx) {
    const { repo, config } = ctx.deps;
    const prestacion = repo.prestaciones().find((p) => p.id === a.prestacion_id)!;
    const profesionales = repo.profesionales().filter((p) => p.prestaciones.includes(a.prestacion_id) && (!a.profesional_id || p.id === a.profesional_id));
    if (!profesionales.length) return { ok: false, error: "Ese profesional no hace esa prestación." };

    const agenda = await repo.agenda();
    const franja = a.franja ?? "cualquiera";
    const dia = DateTime.fromISO(a.fecha, { zone: config.zona });
    const opciones = opcionesDelDia(ctx, agenda, { prestacion, fecha: a.fecha, profesionales, franja, horaPreferida: a.hora_preferida });

    if (opciones.length) {
      const filas = opciones.flatMap((o) =>
        o.horarios.map((h) => ({
          id: `slot|${a.prestacion_id}|${o.profesional_id}|${a.fecha}T${h}`,
          // El título (≤ 24) distingue la fila: hora y apellido del profesional. "09:00 · Dra. Ferreyra"
          titulo: `${h} · ${o.profesional.split(" ").filter((_, i, p) => i === 0 || i === p.length - 1).join(" ")}`,
          descripcion: `${dia.setLocale("es-AR").toFormat("cccc d/M")} · ${prestacion.nombre}`,
        })),
      );
      ctx.sugerencia = { tipo: "lista", boton: "Ver horarios", filas: filas.slice(0, 10) };
      return { ok: true, dia: dia.setLocale("es-AR").toFormat("cccc d/M"), opciones };
    }

    const hoy = DateTime.fromISO(ctx.deps.ahora(), { zone: config.zona }).startOf("day");
    const motivo =
      dia < hoy ? "Ese día ya pasó." : config.feriados.includes(a.fecha) ? MENSAJES_ERROR.feriado : !config.horario[dia.weekday as 1] ? MENSAJES_ERROR.dia_sin_atencion : "No queda lugar ese día.";
    const proximas: { fecha: string; dia: string; primer_horario: string }[] = [];
    for (let d = (dia < hoy ? hoy : dia).plus({ days: 1 }), i = 0; i < 10 && proximas.length < 3; i++, d = d.plus({ days: 1 })) {
      const o = opcionesDelDia(ctx, agenda, { prestacion, fecha: d.toISODate()!, profesionales, franja, horaPreferida: a.hora_preferida });
      if (o.length) proximas.push({ fecha: d.toISODate()!, dia: d.setLocale("es-AR").toFormat("cccc d/M"), primer_horario: o[0].horarios[0] });
    }
    return { ok: false, motivo, proximas_fechas_con_lugar: proximas };
  },

  async reservar_turno(a: { prestacion_id: string; profesional_id: string; inicio: string; nombre_paciente?: string }, ctx) {
    const { repo, config, calendario } = ctx.deps;
    const prestacion = repo.prestaciones().find((p) => p.id === a.prestacion_id)!;
    const profesional = repo.profesionales().find((p) => p.id === a.profesional_id)!;
    if (!profesional.prestaciones.includes(prestacion.id)) return { ok: false, error: "Ese profesional no hace esa prestación." };
    const inicio = desdeLocal(a.inicio, config.zona);
    if (!inicio) return { ok: false, error: "La fecha y hora no tienen el formato YYYY-MM-DDTHH:mm." };
    const paciente = await asegurarPaciente(ctx, a.nombre_paciente);
    if (!paciente) return { ok: false, error: "falta_nombre: pedí nombre y apellido antes de reservar." };

    const agenda = await repo.agenda();
    const id = await repo.nuevoId("tur");
    const r = reservar(agenda, { id, pacienteId: paciente.id, profesionalId: profesional.id, prestacion, inicio }, config, ctx.deps.ahora());
    if (!r.ok) return { ok: false, error: MENSAJES_ERROR[r.error] };
    await repo.guardarAgenda(r.agenda);
    const eventoId = await calendario.crear({
      titulo: `${prestacion.nombre} · ${paciente.nombre}`,
      descripcion: `Turno ${id} con ${profesional.nombre}. Reservado por WhatsApp (TurnoListo, demo con datos ficticios).`,
      inicio: r.turno.inicio,
      fin: r.turno.fin,
    });
    await repo.guardarEventoDeTurno(id, eventoId);
    ctx.sugerencia = undefined;
    return { ok: true, turno: describirTurno(r.turno, ctx), paciente: paciente.nombre };
  },

  async reprogramar_turno(a: { turno_id: string; nuevo_inicio: string }, ctx) {
    const { repo, config, calendario } = ctx.deps;
    const { agenda, turno } = await turnoDelPaciente(ctx, a.turno_id);
    if (!turno) return { ok: false, error: "Ese turno no es de este paciente." };
    const inicio = desdeLocal(a.nuevo_inicio, config.zona);
    if (!inicio) return { ok: false, error: "La fecha y hora no tienen el formato YYYY-MM-DDTHH:mm." };
    const r = reprogramar(agenda, turno.id, inicio, config, ctx.deps.ahora());
    if (!r.ok) return { ok: false, error: MENSAJES_ERROR[r.error] };
    await repo.guardarAgenda(r.agenda);
    const eventoId = await repo.eventoDeTurno(turno.id);
    if (eventoId) await calendario.mover(eventoId, r.turno.inicio, r.turno.fin);
    ctx.reprogramado = true;
    ctx.sugerencia = undefined;
    return { ok: true, antes: fechaLegible(turno.inicio, config.zona), turno: describirTurno(r.turno, ctx) };
  },

  async cancelar_turno(a: { turno_id: string }, ctx) {
    const { repo, config, calendario, mensajero } = ctx.deps;
    const { agenda, turno } = await turnoDelPaciente(ctx, a.turno_id);
    if (!turno) return { ok: false, error: "Ese turno no es de este paciente." };
    const r = cancelar(agenda, turno.id, repo.prestaciones(), config, ctx.deps.ahora());
    if (!r.ok) return { ok: false, error: MENSAJES_ERROR[r.error] };
    await repo.guardarAgenda(r.agenda);
    const eventoId = await repo.eventoDeTurno(turno.id);
    if (eventoId) await calendario.borrar(eventoId);

    if (r.oferta) {
      await repo.guardarOferta(r.oferta);
      const candidato = await repo.paciente(r.oferta.pacienteId);
      if (candidato) {
        await mensajero.enviar({
          para: candidato.telefono.replace(/^\+/, ""),
          texto: `¡Hola, ${candidato.nombre.split(" ")[0]}! Se liberó un turno de ${nombreDe(repo.prestaciones(), r.oferta.prestacionId).toLowerCase()} el ${fechaLegible(r.oferta.inicio, config.zona)} con ${nombreDe(repo.profesionales(), r.oferta.profesionalId)}. ¿Lo querés?`,
          interactivo: {
            tipo: "botones",
            botones: [
              { id: `espera_si|${r.oferta.entradaId}`, titulo: "Sí, lo quiero" },
              { id: `espera_no|${r.oferta.entradaId}`, titulo: "No, gracias" },
            ],
          },
        });
      }
    }
    return { ok: true, cancelado: describirTurno(r.turno, ctx) };
  },

  async info_clinica(a: { tema: string }, ctx) {
    const nombres = Object.fromEntries(ctx.deps.repo.prestaciones().map((p) => [p.id, p.nombre]));
    switch (a.tema) {
      case "direccion":
        return { direccion: clinica.direccion, como_llegar: clinica.como_llegar };
      case "horarios":
        return { horarios: clinica.horarios };
      case "obras_sociales":
        return clinica.obras_sociales;
      case "precios":
        return {
          aclaracion: clinica.precios.aclaracion,
          precios_en_pesos: Object.fromEntries(Object.entries(clinica.precios.lista).map(([id, precio]) => [nombres[id] ?? id, precio])),
        };
      case "medios_de_pago":
        return { medios_de_pago: clinica.medios_de_pago };
      case "politicas":
        return clinica.politicas;
      case "preparacion":
        return clinica.preparacion;
      default:
        return { recepcion: clinica.telefono_recepcion, guardia: clinica.telefono_guardia, horarios: clinica.horarios };
    }
  },

  async anotar_lista_espera(a: { prestacion_id: string; desde: string; hasta: string; profesional_id?: string; nombre_paciente?: string }, ctx) {
    const { repo } = ctx.deps;
    if (a.hasta < a.desde) return { ok: false, error: "La fecha 'hasta' es anterior a 'desde'." };
    const paciente = await asegurarPaciente(ctx, a.nombre_paciente);
    if (!paciente) return { ok: false, error: "falta_nombre: pedí nombre y apellido antes de anotar." };
    const agenda = await repo.agenda();
    const entrada = {
      id: await repo.nuevoId("esp"),
      pacienteId: paciente.id,
      prestacionId: a.prestacion_id,
      ...(a.profesional_id ? { profesionalId: a.profesional_id } : {}),
      desde: a.desde,
      hasta: a.hasta,
      creadoEn: ctx.deps.ahora(),
      estado: "esperando" as const,
    };
    await repo.guardarAgenda({ ...agenda, listaEspera: [...agenda.listaEspera, entrada] });
    return { ok: true, anotado: { id: entrada.id, prestacion: nombreDe(repo.prestaciones(), a.prestacion_id), desde: a.desde, hasta: a.hasta } };
  },

  async derivar_a_recepcion(a: { motivo: MotivoHandoff; resumen: string }, ctx) {
    ctx.handoff = { motivo: a.motivo, resumen: a.resumen };
    return { ok: true, aviso: "Recepción va a seguir la conversación.", ...(a.motivo === "urgencia" ? { telefono_guardia: clinica.telefono_guardia } : {}) };
  },
};

export async function ejecutarHerramienta(nombre: string, args: unknown, ctx: ContextoHerramientas): Promise<Record<string, unknown>> {
  const v = validarArgs(ctx.deps.repo, nombre, args);
  if (!v.ok) return { ok: false, error: `Argumentos inválidos: ${v.error}` };
  ctx.herramientasUsadas.push(nombre);
  const ejecutor = ejecutores[nombre as Exclude<NombreHerramienta, "responder">] as (a: unknown, c: ContextoHerramientas) => Promise<Record<string, unknown>>;
  try {
    return await ejecutor(v.args, ctx);
  } catch (e) {
    return { ok: false, error: `Falló la herramienta: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export const turnosActivosDe = (turnos: Turno[], pacienteId: string, ahora: string) =>
  turnos.filter((t) => t.pacienteId === pacienteId && ACTIVO(t) && Date.parse(t.inicio) > Date.parse(ahora)).sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
