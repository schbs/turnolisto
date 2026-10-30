// Corre las conversaciones de prueba contra Gemini de verdad y, si pasan, guarda las respuestas para los tests.
// Uso: npm run conversaciones:grabar                  (todas)
//      npm run conversaciones:grabar -- reservar urgencia
// Cada llamada al modelo usa la cuota gratis de Gemini: correr solo lo que cambió.
import fs from "node:fs";
import path from "node:path";
import { crearModeloGemini, grabarModelo, type Grabacion, type Modelo } from "../src/agent/modelo";
import { VERSION_PROMPT } from "../src/agent/prompt";
import { cargarCasos, correrCaso, DIR_GRABACIONES, imprimirCorrida } from "../tests/conversations/correr";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: falla abajo con un mensaje claro
}
if (!process.env.GEMINI_API_KEY) {
  console.error("Falta GEMINI_API_KEY en .env.local (npm run check-env).");
  process.exit(1);
}

const pedidos = process.argv.slice(2);
const casos = cargarCasos().filter((c) => !pedidos.length || pedidos.includes(c.nombre));
const real = crearModeloGemini({ apiKey: process.env.GEMINI_API_KEY, modelo: process.env.GEMINI_MODEL || undefined });

// Pausa entre llamadas para no chocar con el límite por minuto del plan gratis.
const pausado: Modelo = {
  nombre: real.nombre,
  async generar(pedido) {
    await new Promise((r) => setTimeout(r, 1500));
    return real.generar(pedido);
  },
};

// tsx compila a CommonJS (el proyecto no es "type": "module"): sin await en el nivel superior.
async function main() {
  fs.mkdirSync(DIR_GRABACIONES, { recursive: true });
  let fallidas = 0;
  let llamadas = 0;
  const tokens = { entrada: 0, salida: 0, pensamiento: 0 };

  for (const caso of casos) {
    const grabador = grabarModelo(pausado);
    const corrida = await correrCaso(caso, grabador.modelo);
    console.log(`\n${imprimirCorrida(caso, corrida)}`);
    for (const r of grabador.respuestas) {
      tokens.entrada += r.uso?.entrada ?? 0;
      tokens.salida += r.uso?.salida ?? 0;
      tokens.pensamiento += r.uso?.pensamiento ?? 0;
    }
    llamadas += grabador.respuestas.length;
    if (corrida.fallas.length) {
      fallidas++;
      console.log(`  ✗ NO se guardó la grabación:\n${corrida.fallas.map((f) => `    - ${f}`).join("\n")}`);
      continue;
    }
    const grabacion: Grabacion = { modelo: real.nombre, versionPrompt: VERSION_PROMPT, grabadoEl: new Date().toISOString(), respuestas: grabador.respuestas };
    fs.writeFileSync(path.join(DIR_GRABACIONES, `${caso.nombre}.json`), JSON.stringify(grabacion, null, 2) + "\n");
    console.log(`  ✓ grabada (${grabador.respuestas.length} llamadas al modelo)`);
  }

  console.log(`\n${casos.length - fallidas}/${casos.length} conversaciones OK · ${llamadas} llamadas a ${real.nombre} · tokens: ${tokens.entrada} de entrada, ${tokens.salida} de salida, ${tokens.pensamiento} de razonamiento`);
  process.exit(fallidas ? 1 : 0);
}

void main();
