// Mide el agente con Gemini de verdad: corre las conversaciones de prueba que usan IA (Calendar y WhatsApp falsos,
// base en memoria, así se mide el agente y no la red de Supabase) y guarda latencias, tokens y costo estimado.
// Uso: npm run bench   (≈ 50 llamadas a Gemini; en el plan gratis cuesta 0)
// Salida: docs/resultados/bench.json
import fs from "node:fs";
import path from "node:path";
import { crearModeloGemini, grabarModelo, MODELO_POR_DEFECTO } from "../src/agent/modelo";
import { VERSION_PROMPT } from "../src/agent/prompt";
import { cargarCasos, correrCaso } from "../tests/conversations/correr";

// Precio del plan pago de Gemini 3.5 Flash-Lite (ai.google.dev/gemini-api/docs/pricing, consultado el 30/10/2026).
// La salida incluye los tokens de razonamiento.
const PRECIO_USD_POR_MILLON = { entrada: 0.3, salida: 2.5 };

// Las que llaman al modelo; "reservar" va dos veces para llegar a 21 mensajes medidos.
const CASOS = ["reservar", "reservar", "reprogramar", "cancelar", "faq-obra-social", "precio", "audio", "fuera-de-tema", "duplicado", "horario-invalido", "lista-espera", "reprogramar-boton", "paciente-nuevo", "nombre-con-tilde"];

const percentil = (valores: number[], p: number) => {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)];
};

async function main() {
  process.loadEnvFile(".env.local");
  const reintentos: { caso: string; motivo: string }[] = [];
  let casoActual = "";
  const modelo = crearModeloGemini({
    apiKey: process.env.GEMINI_API_KEY!,
    modelo: process.env.GEMINI_MODEL || undefined,
    alReintentar: (motivo) => reintentos.push({ caso: casoActual, motivo }),
  });
  const todos = cargarCasos();
  const mensajes: { caso: string; ms: number; llamadas: number; entrada: number; salida: number }[] = [];
  const conversaciones: { caso: string; ok: boolean; fallas: string[]; entrada: number; salida: number; reintentos: string[] }[] = [];

  for (const nombre of CASOS) {
    const caso = todos.find((c) => c.nombre === nombre)!;
    casoActual = nombre;
    const grabador = grabarModelo(modelo);
    const corrida = await correrCaso(caso, grabador.modelo);
    let entrada = 0;
    let salida = 0;
    for (const p of corrida.pasos) {
      if (!p.resultado.llamadasModelo) continue;
      const u = p.resultado.uso ?? { entrada: 0, salida: 0, pensamiento: 0 };
      mensajes.push({ caso: nombre, ms: p.resultado.ms, llamadas: p.resultado.llamadasModelo, entrada: u.entrada, salida: u.salida + u.pensamiento });
      entrada += u.entrada;
      salida += u.salida + u.pensamiento;
    }
    const propios = reintentos.filter((r) => r.caso === nombre).map((r) => r.motivo);
    conversaciones.push({ caso: nombre, ok: corrida.fallas.length === 0, fallas: corrida.fallas, entrada, salida, reintentos: propios });
    console.log(
      `${corrida.fallas.length ? "✗" : "✓"} ${nombre.padEnd(18)} ${corrida.pasos.map((p) => `${p.resultado.ms} ms`).join(", ")}${propios.length ? `   ← reintentos: ${propios.join("; ")}` : ""}`,
    );
    for (const f of corrida.fallas) console.log(`    - ${f}`);
  }

  const ms = mensajes.map((m) => m.ms);
  const costo = (e: number, s: number) => (e * PRECIO_USD_POR_MILLON.entrada + s * PRECIO_USD_POR_MILLON.salida) / 1e6;
  const costos = conversaciones.map((c) => costo(c.entrada, c.salida));
  const reserva = conversaciones.find((c) => c.caso === "reservar")!;
  const resumen = {
    fecha: new Date().toISOString(),
    modelo: process.env.GEMINI_MODEL || MODELO_POR_DEFECTO,
    versionPrompt: VERSION_PROMPT,
    metodo: "procesarMensaje de punta a punta (webhook firmado → reglas → agente → herramientas) con Gemini real; Calendar y WhatsApp falsos; base en memoria",
    mensajesConIA: mensajes.length,
    latenciaMs: { p50: percentil(ms, 50), p95: percentil(ms, 95), min: Math.min(...ms), max: Math.max(...ms) },
    reintentos: { total: reintentos.length, motivos: reintentos },
    // Latencia de los mensajes de conversaciones sin ningún reintento: lo que tarda el agente cuando Gemini responde a la primera.
    latenciaSinReintentosMs: (() => {
      const limpios = mensajes.filter((m) => !reintentos.some((r) => r.caso === m.caso)).map((m) => m.ms);
      return limpios.length ? { mensajes: limpios.length, p50: percentil(limpios, 50), p95: percentil(limpios, 95) } : null;
    })(),
    llamadasPorMensaje: Number((mensajes.reduce((t, m) => t + m.llamadas, 0) / mensajes.length).toFixed(2)),
    conversacionesOk: `${conversaciones.filter((c) => c.ok).length}/${conversaciones.length}`,
    tokensPromedioPorConversacion: {
      entrada: Math.round(conversaciones.reduce((t, c) => t + c.entrada, 0) / conversaciones.length),
      salida: Math.round(conversaciones.reduce((t, c) => t + c.salida, 0) / conversaciones.length),
    },
    costoUsd: {
      fuente: "Gemini 3.5 Flash-Lite plan pago: USD 0,30 / 1M tokens de entrada y USD 2,50 / 1M de salida (ai.google.dev, 30/10/2026). En el plan gratis: 0.",
      promedioPorConversacion: Number((costos.reduce((t, c) => t + c, 0) / costos.length).toFixed(5)),
      reservaCompleta: Number(costo(reserva.entrada, reserva.salida).toFixed(5)),
    },
    mensajes,
    conversaciones,
  };
  const dir = path.join("docs", "resultados");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "bench.json"), JSON.stringify(resumen, null, 2) + "\n");
  console.log(`\n${resumen.mensajesConIA} mensajes con IA · latencia p50 ${resumen.latenciaMs.p50} ms, p95 ${resumen.latenciaMs.p95} ms · ${resumen.llamadasPorMensaje} llamadas al modelo por mensaje`);
  console.log(`conversaciones que cumplen todo: ${resumen.conversacionesOk} · tokens por conversación: ${resumen.tokensPromedioPorConversacion.entrada} de entrada, ${resumen.tokensPromedioPorConversacion.salida} de salida`);
  console.log(`costo estimado (plan pago): USD ${resumen.costoUsd.promedioPorConversacion} por conversación, USD ${resumen.costoUsd.reservaCompleta} una reserva completa`);
  console.log("→ docs/resultados/bench.json");
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
