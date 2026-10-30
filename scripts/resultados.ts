// Junta los resultados medidos en un solo archivo (docs/resultados/resumen.json) e imprime la tabla para el README.
// Corre los tests de unidad y los e2e; Lighthouse y el bench se leen de lo que guardaron (npm run lighthouse / bench).
// Uso: npm run resultados
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = path.join("docs", "resultados");
const leer = <T>(archivo: string): T => JSON.parse(fs.readFileSync(path.join(dir, archivo), "utf8")) as T;
const npx = (args: string[], env: Record<string, string> = {}) => {
  try {
    execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", args, { stdio: "ignore", env: { ...process.env, ...env }, shell: process.platform === "win32" });
  } catch {
    // los totales del JSON dicen si algo falló
  }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "resultados-"));

const vitestJson = path.join(tmp, "vitest.json");
npx(["vitest", "run", "--reporter=json", `--outputFile=${vitestJson}`]);
const vitest = JSON.parse(fs.readFileSync(vitestJson, "utf8")) as {
  numTotalTests: number;
  numPassedTests: number;
  testResults: { name: string; assertionResults: { status: string }[] }[];
};
const conversaciones = vitest.testResults.find((r) => r.name.replaceAll("\\", "/").includes("tests/conversations/"))!;

const e2eJson = path.join(tmp, "e2e.json");
npx(["playwright", "test", "--reporter=json"], { PLAYWRIGHT_JSON_OUTPUT_NAME: e2eJson });
const e2e = JSON.parse(fs.readFileSync(e2eJson, "utf8")) as {
  stats: { expected: number; unexpected: number; flaky: number };
  suites: unknown;
};
const salidaE2e = JSON.stringify(e2e.suites);
const axe = [...salidaE2e.matchAll(/axe → ([^:]+): \d+ reglas OK, (\d+) violaciones \((\d+) serias/g)].map((m) => ({ pagina: m[1], violaciones: Number(m[2]), graves: Number(m[3]) }));

const lighthouse = leer<{ fecha: string; metodo: string; paginas: Record<string, { performance: number; accessibility: number; bestPractices: number; seo: number; lcpSegundos: number }> }>("lighthouse.json");
const bench = leer<{
  fecha: string;
  modelo: string;
  mensajesConIA: number;
  latenciaMs: { p50: number; p95: number };
  latenciaSinReintentosMs: { mensajes: number; p50: number; p95: number } | null;
  reintentos: { total: number };
  llamadasPorMensaje: number;
  conversacionesOk: string;
  tokensPromedioPorConversacion: { entrada: number; salida: number };
  costoUsd: { promedioPorConversacion: number; reservaCompleta: number };
}>("bench.json");

const resumen = {
  fecha: new Date().toISOString(),
  tests: { total: vitest.numTotalTests, ok: vitest.numPassedTests, conversaciones: `${conversaciones.assertionResults.filter((a) => a.status === "passed").length - 1}/16` },
  e2e: { ok: e2e.stats.expected, fallidos: e2e.stats.unexpected + e2e.stats.flaky },
  axe: { paginas: axe.length, violacionesGraves: axe.reduce((t, a) => t + a.graves, 0), violaciones: axe.reduce((t, a) => t + a.violaciones, 0) },
  lighthouse: lighthouse.paginas,
  agente: bench,
};
fs.writeFileSync(path.join(dir, "resumen.json"), JSON.stringify(resumen, null, 2) + "\n");

const lh = (r: string) => {
  const p = lighthouse.paginas[r];
  return `${p.performance} / ${p.accessibility} / ${p.bestPractices} / ${p.seo}`;
};
const s = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
console.log(`| Qué se midió | Resultado |
|---|---|
| Tests de unidad y de dominio (Vitest) | ${resumen.tests.ok}/${resumen.tests.total} |
| Conversaciones de negocio (respuestas de Gemini grabadas) | ${resumen.tests.conversaciones} |
| Conversaciones con Gemini en vivo (\`npm run bench\`) | ${bench.conversacionesOk} |
| E2E con Playwright (celular 390 px y compu 1440 px) | ${resumen.e2e.ok}/${resumen.e2e.ok + resumen.e2e.fallidos} |
| axe WCAG 2.1 AA (${resumen.axe.paginas} revisiones) | ${resumen.axe.violaciones} violaciones (${resumen.axe.violacionesGraves} serias o críticas) |
| Lighthouse móvil \`/\` (rend. / acces. / b. prácticas / SEO) | ${lh("/")} |
| Lighthouse móvil \`/panel\` (con sesión) | ${lh("/panel")} |
| Latencia del agente, p50 (${bench.mensajesConIA} mensajes) | ${s(bench.latenciaMs.p50)} |
| Latencia sin esperas del plan gratis, p50 / p95 (${bench.latenciaSinReintentosMs?.mensajes} mensajes) | ${bench.latenciaSinReintentosMs ? `${s(bench.latenciaSinReintentosMs.p50)} / ${s(bench.latenciaSinReintentosMs.p95)}` : "—"} |
| Llamadas al modelo por mensaje | ${String(bench.llamadasPorMensaje).replace(".", ",")} |
| Costo estimado por conversación (plan pago de ${bench.modelo}) | USD ${String(bench.costoUsd.promedioPorConversacion).replace(".", ",")} |`);
console.log("\n→ docs/resultados/resumen.json");
