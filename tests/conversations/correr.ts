// Corre una conversación de prueba de punta a punta: arma el JSON que mandaría Meta, lo firma, lo pasa por el
// manejador del webhook (el mismo de producción) y revisa lo esperado. Lo usan los tests, el simulador y el grabador.
import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import type { Modelo } from "@/agent/modelo";
import { TranscriptorFake } from "@/audio/transcriptor";
import { crearManejadorWebhook } from "@/bot/manejador";
import { procesarMensaje, type DepsBot, type ResultadoProceso } from "@/bot/procesar";
import { CalendarioFake } from "@/calendario/calendario";
import { configAgenda } from "@/config/clinica";
import { RepositorioMemoria, type Repositorio } from "@/datos/repositorio";
import { oraciones } from "@/agent/agente";
import { aLocal } from "@/domain/formato";
import { firmar } from "@/whatsapp/firma";
import { MensajeroFake, type MensajeSaliente } from "@/whatsapp/mensajero";

export const DIR_CASOS = path.join(import.meta.dirname);
export const DIR_GRABACIONES = path.join(import.meta.dirname, "grabaciones");
const SECRETO_PRUEBA = "secreto-de-prueba-no-es-el-real";

type Entrada = { texto: string } | { audio: string } | { boton: string; titulo: string } | { otro: string };

export interface Espera {
  herramientas?: string[];
  prohibidas?: string[];
  sin_modelo?: boolean;
  incluye?: string[];
  handoff?: string;
  sin_respuesta?: boolean;
  ignorado?: "duplicado" | "pausado";
  interactivo?: "lista" | "botones";
}

export interface Caso {
  nombre: string;
  descripcion: string;
  telefono: string;
  nombre_perfil?: string;
  ahora: string;
  audios?: Record<string, string | null>;
  pasos: { usuario: Entrada; id_mensaje?: string; espera?: Espera }[];
  al_final?: {
    turno_nuevo?: { prestacion: string; inicio: string; profesional?: string };
    turno_movido?: { id: string; inicio: string };
    turno_cancelado?: string;
    turno_confirmado?: string;
    paciente_nuevo?: string;
    eventos_calendario?: number;
    lista_espera_nuevas?: number;
    handoffs?: number;
    salientes_al_paciente?: number;
    mensajes_a_terceros?: number;
  };
}

export interface PasoCorrido {
  entrada: string;
  resultado: ResultadoProceso;
}

export interface Corrida {
  pasos: PasoCorrido[];
  fallas: string[];
  deps: DepsBot & { calendario: CalendarioFake; mensajero: MensajeroFake };
}

export function cargarCasos(): Caso[] {
  return fs
    .readdirSync(DIR_CASOS)
    .filter((f) => /^\d\d-.+\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR_CASOS, f), "utf8")) as Caso);
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function payloadMeta(caso: Caso, entrada: Entrada, id: string, timestamp: number) {
  const cuerpo =
    "texto" in entrada
      ? { type: "text", text: { body: entrada.texto } }
      : "audio" in entrada
        ? { type: "audio", audio: { id: entrada.audio, mime_type: "audio/ogg; codecs=opus", voice: true } }
        : "boton" in entrada
          ? entrada.boton.startsWith("slot|")
            ? { type: "interactive", interactive: { type: "list_reply", list_reply: { id: entrada.boton, title: entrada.titulo } } }
            : { type: "interactive", interactive: { type: "button_reply", button_reply: { id: entrada.boton, title: entrada.titulo } } }
          : { type: entrada.otro, [entrada.otro]: { id: "media-otro" } };
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "000000000000000",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550000000", phone_number_id: "000000000000000" },
              contacts: [{ profile: { name: caso.nombre_perfil ?? "Paciente" }, wa_id: caso.telefono }],
              messages: [{ from: caso.telefono, id, timestamp: String(timestamp), ...cuerpo }],
            },
          },
        ],
      },
    ],
  };
}

const describirEntrada = (e: Entrada) => ("texto" in e ? e.texto : "audio" in e ? `🎤 (audio ${e.audio})` : "boton" in e ? `[toca: ${e.titulo}]` : `(${e.otro})`);

/** repo: por defecto en memoria; el script probar-repositorio-supabase pasa el de Supabase. */
export async function correrCaso(caso: Caso, modelo: Modelo, repo: Repositorio = new RepositorioMemoria()): Promise<Corrida> {
  const inicio = DateTime.fromFormat(caso.ahora, "yyyy-MM-dd HH:mm", { zone: configAgenda.zona });
  let reloj = inicio;
  const deps = {
    repo,
    calendario: new CalendarioFake(),
    mensajero: new MensajeroFake(),
    transcriptor: new TranscriptorFake(caso.audios ?? {}),
    modelo,
    config: configAgenda,
    ahora: () => reloj.toUTC().toISO()!,
  };
  const agendaInicial = await deps.repo.agenda();
  const handoffsAntes = (await deps.repo.handoffs()).length;

  let ultimo: ResultadoProceso | null = null;
  const manejador = crearManejadorWebhook({
    verifyToken: "verificacion-de-prueba",
    appSecret: SECRETO_PRUEBA,
    procesar: async (m) => (ultimo = await procesarMensaje(m, deps)),
    enSegundoPlano: (tarea) => tarea.then(() => undefined),
  });

  const pasos: PasoCorrido[] = [];
  const fallas: string[] = [];
  for (const [i, paso] of caso.pasos.entries()) {
    reloj = inicio.plus({ minutes: i * 2 });
    const id = paso.id_mensaje ?? `wamid.${caso.nombre}.${i + 1}`;
    const crudo = JSON.stringify(payloadMeta(caso, paso.usuario, id, Math.floor(reloj.toSeconds())));
    ultimo = null;
    const respuesta = await manejador.POST(
      new Request("http://localhost/api/whatsapp", { method: "POST", body: crudo, headers: { "x-hub-signature-256": firmar(crudo, SECRETO_PRUEBA) } }),
    );
    if (respuesta.status !== 200) fallas.push(`paso ${i + 1}: el webhook respondió ${respuesta.status}`);
    const resultado: ResultadoProceso = ultimo ?? { herramientas: [], llamadasModelo: 0, ms: 0 };
    pasos.push({ entrada: describirEntrada(paso.usuario), resultado });
    fallas.push(...revisarPaso(i + 1, paso.espera ?? {}, resultado));
  }

  fallas.push(...(await revisarFinal(caso, deps, new Set(agendaInicial.turnos.map((t) => t.id)), agendaInicial.listaEspera.length, handoffsAntes)));
  return { pasos, fallas, deps };
}

function revisarPaso(n: number, e: Espera, r: ResultadoProceso): string[] {
  const f: string[] = [];
  const texto = r.enviado?.texto ?? "";
  for (const h of e.herramientas ?? []) if (!r.herramientas.includes(h)) f.push(`paso ${n}: esperaba la herramienta ${h} (usó: ${r.herramientas.join(", ") || "ninguna"})`);
  for (const h of e.prohibidas ?? []) if (r.herramientas.includes(h)) f.push(`paso ${n}: no debía usar ${h}`);
  if (e.sin_modelo && r.llamadasModelo > 0) f.push(`paso ${n}: no debía llamar al modelo (lo llamó ${r.llamadasModelo} veces)`);
  if (e.incluye && !e.incluye.some((t) => sinTildes(texto).includes(sinTildes(t)))) f.push(`paso ${n}: la respuesta no incluye ninguno de ${JSON.stringify(e.incluye)}: "${texto}"`);
  if (e.handoff && r.handoff !== e.handoff) f.push(`paso ${n}: esperaba derivación "${e.handoff}" (hubo: ${r.handoff ?? "ninguna"})`);
  if (!e.handoff && r.handoff) f.push(`paso ${n}: derivó a recepción sin esperarlo (${r.handoff})`);
  if (e.sin_respuesta && r.enviado) f.push(`paso ${n}: no debía responder y respondió "${texto}"`);
  if (!e.sin_respuesta && !r.enviado) f.push(`paso ${n}: no respondió nada`);
  if (e.ignorado && r.ignorado !== e.ignorado) f.push(`paso ${n}: esperaba que se ignore por ${e.ignorado}`);
  if (e.interactivo && r.enviado?.interactivo?.tipo !== e.interactivo) f.push(`paso ${n}: esperaba un mensaje con ${e.interactivo}`);
  const cantidad = oraciones(texto).length;
  if (cantidad > 3) f.push(`paso ${n}: la respuesta tiene ${cantidad} oraciones (máximo 3)`);
  return f;
}

async function revisarFinal(caso: Caso, deps: Corrida["deps"], turnosAntes: Set<string>, esperaAntes: number, handoffsAntes: number): Promise<string[]> {
  const fin = caso.al_final;
  if (!fin) return [];
  const f: string[] = [];
  const agenda = await deps.repo.agenda();
  const zona = configAgenda.zona;
  const nuevos = agenda.turnos.filter((t) => !turnosAntes.has(t.id));
  const paciente = await deps.repo.pacientePorTelefono(`+${caso.telefono}`);

  if (fin.turno_nuevo) {
    const t = nuevos.find((x) => x.prestacionId === fin.turno_nuevo!.prestacion && aLocal(x.inicio, zona) === fin.turno_nuevo!.inicio);
    if (!t) f.push(`final: no se creó el turno de ${fin.turno_nuevo.prestacion} el ${fin.turno_nuevo.inicio} (nuevos: ${nuevos.map((x) => `${x.prestacionId} ${aLocal(x.inicio, zona)}`).join(", ") || "ninguno"})`);
    else if (fin.turno_nuevo.profesional && t.profesionalId !== fin.turno_nuevo.profesional) f.push(`final: el turno quedó con ${t.profesionalId}, no con ${fin.turno_nuevo.profesional}`);
    else if (t.pacienteId !== paciente?.id) f.push("final: el turno nuevo no quedó a nombre de este paciente");
  } else if (nuevos.length) f.push(`final: se crearon turnos que no se esperaban (${nuevos.length})`);

  if (fin.turno_movido) {
    const t = agenda.turnos.find((x) => x.id === fin.turno_movido!.id);
    if (!t || aLocal(t.inicio, zona) !== fin.turno_movido.inicio) f.push(`final: ${fin.turno_movido.id} debía quedar el ${fin.turno_movido.inicio} (quedó ${t ? aLocal(t.inicio, zona) : "sin turno"})`);
  }
  if (fin.turno_cancelado && agenda.turnos.find((x) => x.id === fin.turno_cancelado)?.estado !== "cancelado") f.push(`final: ${fin.turno_cancelado} debía quedar cancelado`);
  if (fin.turno_confirmado && agenda.turnos.find((x) => x.id === fin.turno_confirmado)?.estado !== "confirmado") f.push(`final: ${fin.turno_confirmado} debía quedar confirmado`);
  if (fin.paciente_nuevo !== undefined && paciente?.nombre !== fin.paciente_nuevo) f.push(`final: el paciente nuevo debía llamarse "${fin.paciente_nuevo}" (quedó "${paciente?.nombre ?? "sin registrar"}")`);
  if (fin.eventos_calendario !== undefined && deps.calendario.eventos.size !== fin.eventos_calendario) f.push(`final: ${deps.calendario.eventos.size} eventos en el calendario (esperaba ${fin.eventos_calendario})`);
  if (fin.lista_espera_nuevas !== undefined && agenda.listaEspera.length - esperaAntes !== fin.lista_espera_nuevas) f.push(`final: ${agenda.listaEspera.length - esperaAntes} anotados en lista de espera (esperaba ${fin.lista_espera_nuevas})`);
  const handoffsNuevos = (await deps.repo.handoffs()).length - handoffsAntes;
  if (fin.handoffs !== undefined && handoffsNuevos !== fin.handoffs) f.push(`final: ${handoffsNuevos} derivaciones nuevas (esperaba ${fin.handoffs})`);
  const salientes = deps.mensajero.enviados as MensajeSaliente[];
  const alPaciente = salientes.filter((m) => m.para === caso.telefono).length;
  if (fin.salientes_al_paciente !== undefined && alPaciente !== fin.salientes_al_paciente) f.push(`final: ${alPaciente} mensajes al paciente (esperaba ${fin.salientes_al_paciente})`);
  if (fin.mensajes_a_terceros !== undefined && salientes.length - alPaciente !== fin.mensajes_a_terceros) f.push(`final: ${salientes.length - alPaciente} mensajes a otros números (esperaba ${fin.mensajes_a_terceros})`);
  return f;
}

/** Conversación en formato chat, para el simulador y el grabador. */
export function imprimirCorrida(caso: Caso, corrida: Corrida): string {
  const lineas = [`── ${caso.nombre}: ${caso.descripcion}`];
  for (const p of corrida.pasos) {
    lineas.push(`  👤 ${p.entrada}`);
    const r = p.resultado;
    if (r.ignorado) lineas.push(`     (ignorado: ${r.ignorado})`);
    if (r.herramientas.length) lineas.push(`     🔧 ${r.herramientas.join(" → ")}`);
    if (r.enviado) {
      lineas.push(`  🤖 ${r.enviado.texto}`);
      const i = r.enviado.interactivo;
      if (i?.tipo === "lista") lineas.push(`     [lista "${i.boton}": ${i.filas.map((f) => f.titulo).join(" · ")}]`);
      if (i?.tipo === "botones") lineas.push(`     [botones: ${i.botones.map((b) => b.titulo).join(" · ")}]`);
    }
    if (r.handoff) lineas.push(`     ↪ derivado a recepción (${r.handoff})`);
  }
  return lineas.join("\n");
}
