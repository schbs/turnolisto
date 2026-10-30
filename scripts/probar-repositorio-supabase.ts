// Corre conversaciones grabadas contra la base real de Supabase (con Calendar y WhatsApp falsos) para probar
// RepositorioSupabase de punta a punta. Al final vuelve a cargar el seed. Uso: npm run probar-repositorio-supabase
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { crearModeloGrabado, type Grabacion } from "../src/agent/modelo";
import { RepositorioSupabase } from "../src/datos/repositorio-supabase";
import { cargarCasos, correrCaso, DIR_GRABACIONES } from "../tests/conversations/correr";

const CASOS = ["reservar", "cancelar", "paciente-nuevo", "duplicado", "confirmar-boton", "pide-humano"];

async function main() {
  process.loadEnvFile(".env.local");
  let fallas = 0;
  for (const caso of cargarCasos().filter((c) => CASOS.includes(c.nombre))) {
    const grabacion = JSON.parse(fs.readFileSync(path.join(DIR_GRABACIONES, `${caso.nombre}.json`), "utf8")) as Grabacion;
    const t0 = Date.now();
    const corrida = await correrCaso(caso, crearModeloGrabado(grabacion), await RepositorioSupabase.crear());
    const ms = corrida.pasos.map((p) => p.resultado.ms);
    console.log(`${corrida.fallas.length ? "✗" : "✓"} ${caso.nombre.padEnd(16)} ${Date.now() - t0} ms en total (por mensaje: ${ms.join(", ")} ms)`);
    for (const f of corrida.fallas) console.log(`    - ${f}`);
    fallas += corrida.fallas.length;
    execSync("npx tsx scripts/db-seed.ts", { stdio: "ignore" }); // cada caso arranca de la base limpia
  }
  console.log(fallas ? `\n${fallas} falla(s)` : "\nTodo OK contra Supabase. La base quedó con el seed.");
  process.exit(fallas ? 1 : 0);
}

void main();
