// Qué hace el bot con cada mensaje entrante: deduplica, transcribe, aplica reglas fijas, botones y, si hace falta, el agente.
import clinica from "../../data/clinica.json";
import { ejecutarAgente } from "@/agent/agente";
import { turnosActivosDe, type ContextoHerramientas, type DepsHerramientas } from "@/agent/herramientas";
import type { Modelo, Uso } from "@/agent/modelo";
import { construirSistema } from "@/agent/prompt";
import type { Transcriptor } from "@/audio/transcriptor";
import type { EstadoConversacion, MotivoHandoff, Paciente } from "@/datos/repositorio";
import { confirmar, reservar } from "@/domain/agenda";
import { desdeLocal, fechaLegible } from "@/domain/formato";
import { normalizarTelefonoAR } from "@/domain/telefono";
import type { MensajeSaliente } from "@/whatsapp/mensajero";
import type { MensajeEntrante } from "@/whatsapp/webhook";
import { esUrgencia, pideHumano } from "./reglas";

export interface DepsBot extends DepsHerramientas {
  modelo: Modelo;
  transcriptor: Transcriptor;
  /** Modo demo: si está, solo se atiende a estos wa_id (el resto se ignora sin gastar IA). */
  remitentesPermitidos?: string[];
}

export interface ResultadoProceso {
  ignorado?: "duplicado" | "pausado" | "no_permitido";
  enviado?: MensajeSaliente;
  herramientas: string[];
  handoff?: MotivoHandoff;
  llamadasModelo: number;
  uso?: Uso;
  ms: number;
}

const HISTORIAL_MAX = 12;

const TEXTOS = {
  audioIlegible: "No pude escuchar bien el audio 🙏 ¿Me lo escribís?",
  tipoNoSoportado: "Por ahora solo puedo leer mensajes de texto y notas de voz. ¿Me lo escribís?",
  urgencia: `Lamento mucho el dolor. Ya le aviso a recepción para que te atiendan lo antes posible; si es urgente, llamá ahora a la guardia: ${clinica.telefono_guardia}.`,
  humano: "¡Claro! Le paso tu consulta a recepción y una persona te escribe por acá a la brevedad.",
  noEntiendo: "Perdón, no te estoy entendiendo bien. Le paso la conversación a recepción para que te ayuden.",
  fallaTecnica: "Perdón, tuve un problema técnico y no pude procesar tu mensaje. Ya le aviso a recepción para que te responda por acá.",
  reprogramarPregunta: "Dale, lo cambiamos. ¿Qué día y en qué horario te queda mejor?",
  turnoInactivo: "Ese turno ya no está activo. Si querés, te ayudo a sacar uno nuevo.",
  ofertaVencida: "Uy, ese turno ya no está disponible. Te sigo avisando si se libera otro.",
  ofertaRechazada: "¡Listo! Seguís en la lista de espera y te aviso si se libera otro horario.",
};

const nombreDe = (lista: { id: string; nombre: string }[], id: string) => lista.find((x) => x.id === id)?.nombre ?? id;

export async function procesarMensaje(m: MensajeEntrante, deps: DepsBot): Promise<ResultadoProceso> {
  const t0 = Date.now();
  const resultado: ResultadoProceso = { herramientas: [], llamadasModelo: 0, ms: 0 };
  const { repo } = deps;

  if (deps.remitentesPermitidos && !deps.remitentesPermitidos.includes(m.de)) return { ...resultado, ignorado: "no_permitido", ms: Date.now() - t0 };
  if (!(await repo.marcarMensajeProcesado(m.id))) return { ...resultado, ignorado: "duplicado", ms: Date.now() - t0 };

  const telefono = normalizarTelefonoAR(m.de) ?? `+${m.de}`;
  const estado = await repo.conversacion(telefono);
  let paciente = await repo.pacientePorTelefono(telefono);

  const enviar = async (texto: string, extra: Partial<MensajeSaliente> = {}) => {
    const salida: MensajeSaliente = { para: m.de, texto, ...extra };
    await deps.mensajero.enviar(salida);
    await repo.registrarMensaje({ telefono, direccion: "saliente", tipo: salida.interactivo?.tipo ?? "texto", texto, creadoEn: deps.ahora() });
    resultado.enviado = salida;
    return salida;
  };
  const cerrar = async (entrada: string, salida?: string) => {
    if (salida) estado.historial = [...estado.historial, { rol: "usuario" as const, texto: entrada }, { rol: "asistente" as const, texto: salida }].slice(-HISTORIAL_MAX);
    await repo.guardarConversacion(estado);
    resultado.ms = Date.now() - t0;
    return resultado;
  };
  const derivar = async (motivo: MotivoHandoff, resumen: string) => {
    await repo.registrarHandoff({ telefono, pacienteId: paciente?.id, motivo, resumen, creadoEn: deps.ahora() });
    estado.pausado = true;
    estado.fallos = 0;
    resultado.handoff = motivo;
  };

  // 1. Pasar todo a texto (o resolver el botón sin IA).
  let texto: string;
  if (m.tipo === "texto") texto = m.texto;
  else if (m.tipo === "audio") {
    const transcripcion = await deps.transcriptor.transcribir(m.mediaId);
    await repo.registrarMensaje({ telefono, direccion: "entrante", tipo: "audio", texto: transcripcion ?? "(audio sin transcribir)", creadoEn: deps.ahora() });
    if (!transcripcion) {
      if (!estado.pausado) await enviar(TEXTOS.audioIlegible);
      return cerrar("(audio)");
    }
    texto = transcripcion;
  } else if (m.tipo === "boton") {
    const [accion, ...resto] = m.idRespuesta.split("|");
    if (accion === "slot") {
      const [prestacionId, profesionalId, inicio] = resto;
      const iso = desdeLocal(inicio, deps.config.zona);
      texto = iso
        ? `[Eligió de la lista: ${nombreDe(repo.prestaciones(), prestacionId)} el ${fechaLegible(iso, deps.config.zona)} con ${nombreDe(repo.profesionales(), profesionalId)}. prestacion_id=${prestacionId}, profesional_id=${profesionalId}, inicio=${inicio}]`
        : m.titulo;
    } else {
      await repo.registrarMensaje({ telefono, direccion: "entrante", tipo: "boton", texto: m.titulo, creadoEn: deps.ahora() });
      if (estado.pausado) return cerrar(m.titulo);
      const respuesta = await resolverBoton(accion, resto[0] ?? "", { deps, paciente, estado });
      await enviar(respuesta);
      return cerrar(m.titulo, respuesta);
    }
  } else {
    await repo.registrarMensaje({ telefono, direccion: "entrante", tipo: m.tipoOriginal, texto: `(${m.tipoOriginal})`, creadoEn: deps.ahora() });
    if (!estado.pausado) await enviar(TEXTOS.tipoNoSoportado);
    return cerrar(`(${m.tipoOriginal})`);
  }

  if (m.tipo !== "audio") await repo.registrarMensaje({ telefono, direccion: "entrante", tipo: m.tipo, texto, creadoEn: deps.ahora() });

  // 2. Con la conversación en manos de recepción, el bot no contesta.
  if (estado.pausado) return { ...(await cerrar(texto)), ignorado: "pausado" };

  // 3. Reglas fijas: urgencia y pedido de una persona.
  if (esUrgencia(texto)) {
    await derivar("urgencia", texto.slice(0, 300));
    const salida = await enviar(TEXTOS.urgencia);
    return cerrar(texto, salida.texto);
  }
  if (pideHumano(texto)) {
    await derivar("pedido_del_paciente", texto.slice(0, 300));
    const salida = await enviar(TEXTOS.humano);
    return cerrar(texto, salida.texto);
  }

  // 4. El agente.
  const agenda = await repo.agenda();
  const turnosDelPaciente = paciente ? turnosActivosDe(agenda.turnos, paciente.id, deps.ahora()) : [];
  const ctx: ContextoHerramientas = { deps, telefono, paciente, herramientasUsadas: [] };
  const sistema = construirSistema({
    ahora: deps.ahora(),
    zona: deps.config.zona,
    paciente,
    nombrePerfil: m.nombrePerfil,
    turnosDelPaciente,
    reprogramando: turnosDelPaciente.find((t) => t.id === estado.reprogramando),
    prestaciones: repo.prestaciones(),
    profesionales: repo.profesionales(),
  });
  let r: Awaited<ReturnType<typeof ejecutarAgente>>;
  try {
    r = await ejecutarAgente({ modelo: deps.modelo, sistema, estado, mensaje: texto, ctx });
  } catch (e) {
    // Sin IA (cupo agotado, caída): el paciente igual recibe respuesta y recepción se entera.
    console.error("[turnolisto] el agente no pudo responder:", e instanceof Error ? e.message : e);
    await derivar("otro", `El asistente no pudo responder por una falla técnica. Mensaje: "${texto.slice(0, 200)}"`);
    const salida = await enviar(TEXTOS.fallaTecnica);
    return cerrar(texto, salida.texto);
  }
  paciente = ctx.paciente;
  resultado.herramientas = ctx.herramientasUsadas;
  resultado.llamadasModelo = r.llamadasModelo;
  resultado.uso = r.uso;

  let respuesta = r.respuesta.texto;
  if (ctx.handoff) {
    await derivar(ctx.handoff.motivo, ctx.handoff.resumen);
  } else if (!r.respuesta.entendio) {
    estado.fallos += 1;
    if (estado.fallos >= 2) {
      await derivar("no_entiendo", `El asistente no entendió dos mensajes seguidos. Último: "${texto.slice(0, 200)}"`);
      respuesta = TEXTOS.noEntiendo;
    }
  } else {
    estado.fallos = 0;
  }
  if (ctx.reprogramado) estado.reprogramando = undefined;

  const salida = await enviar(respuesta, ctx.sugerencia && !ctx.handoff ? { interactivo: ctx.sugerencia } : {});
  return cerrar(texto, salida.texto);
}

async function resolverBoton(
  accion: string,
  id: string,
  { deps, paciente, estado }: { deps: DepsBot; paciente: Paciente | null; estado: EstadoConversacion },
): Promise<string> {
  const { repo, config } = deps;
  const agenda = await repo.agenda();

  if (accion === "confirmar" || accion === "reprogramar") {
    const turno = agenda.turnos.find((t) => t.id === id && t.pacienteId === paciente?.id);
    if (!turno || !["reservado", "confirmado"].includes(turno.estado)) return TEXTOS.turnoInactivo;
    if (accion === "reprogramar") {
      estado.reprogramando = turno.id;
      return TEXTOS.reprogramarPregunta;
    }
    const r = confirmar(agenda, turno.id);
    if (!r.ok) return TEXTOS.turnoInactivo;
    await repo.guardarAgenda(r.agenda);
    return `¡Gracias! Tu turno de ${nombreDe(repo.prestaciones(), turno.prestacionId).toLowerCase()} del ${fechaLegible(turno.inicio, config.zona)} quedó confirmado. Te esperamos 😊`;
  }

  if (accion === "espera_si" || accion === "espera_no") {
    const oferta = await repo.oferta(id);
    const entrada = agenda.listaEspera.find((e) => e.id === id);
    if (!oferta || !entrada || entrada.estado !== "ofrecido" || entrada.pacienteId !== paciente?.id) return TEXTOS.ofertaVencida;
    if (accion === "espera_no") {
      await repo.guardarAgenda({ ...agenda, listaEspera: agenda.listaEspera.map((e) => (e.id === id ? { ...e, estado: "esperando" } : e)) });
      return TEXTOS.ofertaRechazada;
    }
    const prestacion = repo.prestaciones().find((p) => p.id === oferta.prestacionId)!;
    const turnoId = await repo.nuevoId("tur");
    const r = reservar(agenda, { id: turnoId, pacienteId: paciente.id, profesionalId: oferta.profesionalId, prestacion, inicio: oferta.inicio }, config, deps.ahora());
    if (!r.ok) return TEXTOS.ofertaVencida;
    await repo.guardarAgenda({ ...r.agenda, listaEspera: r.agenda.listaEspera.map((e) => (e.id === id ? { ...e, estado: "asignado" } : e)) });
    const eventoId = await deps.calendario.crear({
      titulo: `${prestacion.nombre} · ${paciente.nombre}`,
      descripcion: `Turno ${turnoId} asignado desde la lista de espera (TurnoListo, demo con datos ficticios).`,
      inicio: r.turno.inicio,
      fin: r.turno.fin,
    });
    await repo.guardarEventoDeTurno(turnoId, eventoId);
    return `¡Listo! Te quedó el turno de ${prestacion.nombre.toLowerCase()} el ${fechaLegible(r.turno.inicio, config.zona)} con ${nombreDe(repo.profesionales(), oferta.profesionalId)}.`;
  }

  return "No entendí esa opción. ¿Me contás qué necesitás?";
}

