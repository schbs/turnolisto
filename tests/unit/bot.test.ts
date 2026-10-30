import { describe, expect, it } from "vitest";
import { oraciones, recortarOraciones } from "@/agent/agente";
import { ejecutarHerramienta, type ContextoHerramientas } from "@/agent/herramientas";
import { segundosDeEspera, type Modelo, type Parte } from "@/agent/modelo";
import { TranscriptorFake } from "@/audio/transcriptor";
import { procesarMensaje, type DepsBot } from "@/bot/procesar";
import { esUrgencia, pideHumano } from "@/bot/reglas";
import { CalendarioFake } from "@/calendario/calendario";
import { configAgenda } from "@/config/clinica";
import { RepositorioMemoria } from "@/datos/repositorio";
import { MensajeroFake } from "@/whatsapp/mensajero";
import type { MensajeEntrante } from "@/whatsapp/webhook";
import { local } from "../fixtures/agenda";

/** Modelo que devuelve, en orden, las partes que se le indiquen (para probar el bot sin red). */
function modeloGuionado(respuestas: Parte[][]): Modelo & { pedidos: number } {
  const m = {
    nombre: "guionado",
    pedidos: 0,
    async generar() {
      const parts = respuestas[m.pedidos++];
      if (!parts) throw new Error("El guion se terminó");
      return { contenido: { role: "model" as const, parts } };
    },
  };
  return m;
}

const responder = (texto: string, entendio = true): Parte => ({ functionCall: { name: "responder", args: { texto, entendio, tema: "otro" } } });

function deps(modelo: Modelo, audios: Record<string, string | null> = {}) {
  return {
    repo: new RepositorioMemoria(),
    calendario: new CalendarioFake(),
    mensajero: new MensajeroFake(),
    transcriptor: new TranscriptorFake(audios),
    modelo,
    config: configAgenda,
    ahora: () => local("2026-11-02 08:00"),
  } satisfies DepsBot;
}

let n = 0;
const texto = (t: string, de = "5492995550102"): MensajeEntrante => ({ id: `w${++n}`, de, timestamp: 0, tipo: "texto", texto: t });

describe("reglas fijas", () => {
  it.each(["Me duele mucho la muela", "tengo un dolor muy fuerte", "me sangra la encía", "se me hinchó la cara", "es urgente"])("urgencia: %s", (t) =>
    expect(esUrgencia(t)).toBe(true),
  );
  it.each(["quiero un turno", "¿cuánto sale una limpieza?", "me duele un poco cuando como frío"])("no es urgencia: %s", (t) => expect(esUrgencia(t)).toBe(false));
  it("pedido de una persona", () => {
    expect(pideHumano("Quiero hablar con una persona")).toBe(true);
    expect(pideHumano("pasame con recepción")).toBe(true);
    expect(pideHumano("quiero hablar de mi turno")).toBe(false);
  });
});

describe("oraciones", () => {
  it("no corta en abreviaturas ni en precios", () => {
    expect(oraciones("Con la Dra. Ibáñez a las 15 hs. El precio es $150.000. ¿Te sirve?")).toHaveLength(3);
    expect(recortarOraciones("Uno. Dos. Tres. Cuatro.")).toBe("Uno. Dos. Tres.");
  });
});

describe("procesarMensaje", () => {
  it("dos respuestas seguidas sin entender → deriva a recepción y el bot se pausa", async () => {
    const modelo = modeloGuionado([[responder("¿Perdón?", false)], [responder("No te entendí.", false)]]);
    const d = deps(modelo);
    const r1 = await procesarMensaje(texto("asdfgh"), d);
    expect(r1.handoff).toBeUndefined();
    const r2 = await procesarMensaje(texto("qwerty"), d);
    expect(r2.handoff).toBe("no_entiendo");
    expect(r2.enviado?.texto).toMatch(/recepción/);
    const r3 = await procesarMensaje(texto("hola?"), d);
    expect(r3.ignorado).toBe("pausado");
    expect(modelo.pedidos).toBe(2);
  });

  it("un mensaje entendido en el medio reinicia el contador", async () => {
    const d = deps(modeloGuionado([[responder("¿Perdón?", false)], [responder("¡Hola!")], [responder("¿Cómo?", false)]]));
    for (const t of ["x", "hola", "y"]) expect((await procesarMensaje(texto(t), d)).handoff).toBeUndefined();
  });

  it("modo demo: un número que no está autorizado se ignora sin llamar al modelo ni responder", async () => {
    const modelo = modeloGuionado([]);
    const r = await procesarMensaje(texto("quiero un turno", "5491100000000"), { ...deps(modelo), remitentesPermitidos: ["5492995550102"] });
    expect(r.ignorado).toBe("no_permitido");
    expect(r.enviado).toBeUndefined();
    expect(modelo.pedidos).toBe(0);
  });

  it("si el modelo falla (por ejemplo, sin cupo), responde igual y deriva a recepción", async () => {
    const caido: Modelo = { nombre: "caido", generar: async () => Promise.reject(new Error("Gemini respondió 429")) };
    const r = await procesarMensaje(texto("quiero un turno"), deps(caido));
    expect(r.enviado?.texto).toMatch(/problema técnico/);
    expect(r.handoff).toBe("otro");
  });

  it("lee la espera que pide Gemini en un 429", () => {
    expect(segundosDeEspera("Please retry in 12h9m7.84s.")).toBeCloseTo(43747.84);
    expect(segundosDeEspera("Please retry in 31.2s.")).toBeCloseTo(31.2);
    expect(segundosDeEspera("sin datos")).toBe(0);
  });

  it("audio que no se pudo transcribir: pide que lo escriban, sin llamar al modelo", async () => {
    const modelo = modeloGuionado([]);
    const r = await procesarMensaje({ id: "a1", de: "5492995550102", timestamp: 0, tipo: "audio", mediaId: "roto" }, deps(modelo, { roto: null }));
    expect(r.enviado?.texto).toMatch(/escribís/);
    expect(modelo.pedidos).toBe(0);
  });

  it("sticker u otro tipo: avisa que solo lee texto y audios", async () => {
    const r = await procesarMensaje({ id: "s1", de: "5492995550102", timestamp: 0, tipo: "otro", tipoOriginal: "sticker" }, deps(modeloGuionado([])));
    expect(r.enviado?.texto).toMatch(/texto y notas de voz/);
  });

  it("un argumento inválido del modelo vuelve como error y el modelo puede corregirse", async () => {
    const modelo = modeloGuionado([
      [{ functionCall: { name: "buscar_slots", args: { prestacion_id: "inexistente", fecha: "mañana" } } }],
      [responder("¿Para qué prestación sería?")],
    ]);
    const r = await procesarMensaje(texto("quiero turno"), deps(modelo));
    expect(r.herramientas).toEqual([]);
    expect(r.enviado?.texto).toBe("¿Para qué prestación sería?");
  });
});

describe("herramientas", () => {
  const ctx = (d: ReturnType<typeof deps>, paciente: ContextoHerramientas["paciente"] = null): ContextoHerramientas => ({
    deps: d,
    telefono: "+5492995550188",
    paciente,
    herramientasUsadas: [],
  });

  it("buscar_slots un domingo: explica el motivo y propone próximas fechas", async () => {
    const r = await ejecutarHerramienta("buscar_slots", { prestacion_id: "consulta", fecha: "2026-11-08" }, ctx(deps(modeloGuionado([]))));
    expect(r).toMatchObject({ ok: false, motivo: "Ese día la clínica no atiende." });
    expect((r.proximas_fechas_con_lugar as { fecha: string }[])[0].fecha).toBe("2026-11-09");
  });

  it("buscar_slots con hora preferida trae primero los horarios cercanos", async () => {
    const r = await ejecutarHerramienta("buscar_slots", { prestacion_id: "limpieza", fecha: "2026-11-06", profesional_id: "prof-ibanez", hora_preferida: "11:00" }, ctx(deps(modeloGuionado([]))));
    expect((r.opciones as { horarios: string[] }[])[0].horarios).toContain("11:00");
  });

  it("reservar sin nombre para un número desconocido pide el nombre; con nombre crea paciente, turno y evento", async () => {
    const d = deps(modeloGuionado([]));
    const c = ctx(d);
    const args = { prestacion_id: "consulta", profesional_id: "prof-quintana", inicio: "2026-11-03T10:00" };
    expect(await ejecutarHerramienta("reservar_turno", args, c)).toMatchObject({ ok: false });
    const r = await ejecutarHerramienta("reservar_turno", { ...args, nombre_paciente: "Iñaki Núñez" }, c);
    expect(r).toMatchObject({ ok: true, paciente: "Iñaki Núñez" });
    expect([...d.calendario.eventos.values()][0].titulo).toContain("Iñaki Núñez");
  });

  it("cancelar ofrece el hueco por WhatsApp al primero de la lista de espera, que lo acepta con un botón", async () => {
    const d = deps(modeloGuionado([]));
    const julieta = await d.repo.pacientePorTelefono("+5492995550123");
    const r = await ejecutarHerramienta("cancelar_turno", { turno_id: "tur-007" }, { ...ctx(d, julieta), telefono: julieta!.telefono });
    expect(r).toMatchObject({ ok: true });
    const oferta = d.mensajero.enviados[0];
    expect(oferta.interactivo?.tipo).toBe("botones");
    const si = oferta.interactivo?.tipo === "botones" ? oferta.interactivo.botones[0] : null;
    const respuesta = await procesarMensaje({ id: "b1", de: oferta.para, timestamp: 0, tipo: "boton", idRespuesta: si!.id, titulo: si!.titulo }, d);
    expect(respuesta.enviado?.texto).toMatch(/Te quedó el turno/);
    const agenda = await d.repo.agenda();
    expect(agenda.listaEspera.find((e) => e.id === si!.id.split("|")[1])?.estado).toBe("asignado");
    expect(d.calendario.eventos.size).toBe(1);
  });

  it("no deja reprogramar ni cancelar turnos de otro paciente", async () => {
    const d = deps(modeloGuionado([]));
    const tomas = await d.repo.pacientePorTelefono("+5492995550102");
    expect(await ejecutarHerramienta("cancelar_turno", { turno_id: "tur-007" }, ctx(d, tomas))).toMatchObject({ ok: false });
    expect(await ejecutarHerramienta("reprogramar_turno", { turno_id: "tur-007", nuevo_inicio: "2026-11-06T10:00" }, ctx(d, tomas))).toMatchObject({ ok: false });
  });

  it("info_clinica de precios sale de la tabla de la clínica", async () => {
    const r = await ejecutarHerramienta("info_clinica", { tema: "precios" }, ctx(deps(modeloGuionado([]))));
    expect((r.precios_en_pesos as Record<string, number>).Blanqueamiento).toBe(150000);
  });
});
