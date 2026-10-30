// Simulador local: manda una conversación de prueba al webhook (firmado como lo firma Meta) sin Meta, sin teléfono
// y con un Google Calendar falso en memoria.
// Uso: npm run simular                     (caso "reservar", con las respuestas grabadas de Gemini)
//      npm run simular -- cancelar
//      npm run simular -- reservar --real   (llama a Gemini de verdad; usa cuota)
import fs from "node:fs";
import path from "node:path";
import { crearModeloGemini, crearModeloGrabado, type Grabacion, type Modelo } from "../src/agent/modelo";
import { configAgenda } from "../src/config/clinica";
import { aLocal } from "../src/domain/formato";
import { cargarCasos, correrCaso, DIR_GRABACIONES, imprimirCorrida } from "../tests/conversations/correr";

const args = process.argv.slice(2);
const real = args.includes("--real");
const nombre = args.find((a) => !a.startsWith("--")) ?? "reservar";
const caso = cargarCasos().find((c) => c.nombre === nombre)!;
if (!caso) {
  console.error(`No existe el caso "${nombre}". Casos: ${cargarCasos().map((c) => c.nombre).join(", ")}`);
  process.exit(1);
}

let modelo: Modelo;
if (real) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // sigue: el chequeo de abajo avisa
  }
  if (!process.env.GEMINI_API_KEY) throw new Error("Falta GEMINI_API_KEY en .env.local");
  modelo = crearModeloGemini({ apiKey: process.env.GEMINI_API_KEY, modelo: process.env.GEMINI_MODEL || undefined });
} else {
  const grabacion = JSON.parse(fs.readFileSync(path.join(DIR_GRABACIONES, `${nombre}.json`), "utf8")) as Grabacion;
  modelo = crearModeloGrabado(grabacion);
}

// tsx compila a CommonJS (el proyecto no es "type": "module"): sin await en el nivel superior.
async function main() {
  const corrida = await correrCaso(caso, modelo);
  console.log(`Modelo: ${modelo.nombre} · webhook firmado con X-Hub-Signature-256 · Calendar y WhatsApp falsos\n`);
  console.log(imprimirCorrida(caso, corrida));

  const { deps } = corrida;
  const eventos = [...deps.calendario.eventos.entries()];
  console.log(`\nGoogle Calendar (falso): ${eventos.length} evento(s)`);
  for (const [id, e] of eventos) console.log(`  ${id}: "${e.titulo}" de ${aLocal(e.inicio, configAgenda.zona)} a ${aLocal(e.fin, configAgenda.zona).slice(11)}`);
  const terceros = deps.mensajero.enviados.filter((m) => m.para !== caso.telefono);
  if (terceros.length) console.log(`Mensajes a otros pacientes (lista de espera): ${terceros.length}\n${terceros.map((m) => `  → ${m.para}: ${m.texto}`).join("\n")}`);
  const tiempos = corrida.pasos.map((p) => p.resultado.ms);
  console.log(`\nTiempo de proceso por mensaje: ${tiempos.map((t) => `${t} ms`).join(", ")}`);
  console.log(corrida.fallas.length ? `\n✗ ${corrida.fallas.length} falla(s):\n${corrida.fallas.join("\n")}` : "\n✓ Cumple todo lo esperado del caso.");
  process.exit(corrida.fallas.length ? 1 : 0);
}

void main();
