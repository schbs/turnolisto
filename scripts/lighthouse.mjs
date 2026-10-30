// Lighthouse móvil (throttling simulado) sobre el build de producción local, con Brave sin interfaz.
// Mide / y /panel, y sus versiones en inglés /en y /en/panel (los paneles con la sesión del usuario demo). Imprime los 4 puntajes y sale con error si alguno es < 90.
// Uso: npm run build && npm run lighthouse            (3 corridas por página, se informa la mediana por rendimiento)
//      npm run lighthouse -- --corridas=1
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local no se puede medir /panel: falla en el login con un mensaje claro
}

const BASE = "http://localhost:3201";
const corridas = Number(process.argv.find((a) => a.startsWith("--corridas="))?.split("=")[1] ?? 3);
const BRAVE = process.env.BRAVE_PATH ?? path.join(process.env.LOCALAPPDATA ?? "", "BraveSoftware/Brave-Browser/Application/brave.exe");
const LH = path.join("node_modules", "lighthouse", "cli", "index.js");
const carpeta = mkdtempSync(path.join(tmpdir(), "lh-turnolisto-"));
const CATEGORIAS = ["performance", "accessibility", "best-practices", "seo"];

async function servidorArriba() {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
}

async function cookieDeSesion() {
  const navegador = await chromium.launch({ executablePath: BRAVE });
  const pagina = await navegador.newPage();
  await pagina.goto(`${BASE}/panel/ingresar`);
  await pagina.getByLabel("Email").fill(process.env.PANEL_DEMO_EMAIL ?? "");
  await pagina.getByLabel("Contraseña").fill(process.env.PANEL_DEMO_PASSWORD ?? "");
  await pagina.getByRole("button", { name: "Ingresar" }).click();
  await pagina.getByRole("heading", { name: "Agenda de la semana" }).waitFor({ timeout: 15_000 });
  const cookies = await pagina.context().cookies(BASE);
  await navegador.close();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

function medir(url, archivo, encabezados) {
  execFileSync(
    process.execPath,
    [
      LH,
      url,
      "--form-factor=mobile",
      `--only-categories=${CATEGORIAS.join(",")}`,
      "--chrome-flags=--headless=new",
      "--output=json",
      `--output-path=${archivo}`,
      "--quiet",
      ...(encabezados ? [`--extra-headers=${JSON.stringify(encabezados)}`] : []),
    ],
    { env: { ...process.env, CHROME_PATH: BRAVE }, stdio: "ignore" },
  );
  const r = JSON.parse(readFileSync(archivo, "utf8"));
  const puntajes = Object.fromEntries(CATEGORIAS.map((c) => [c, Math.round((r.categories[c]?.score ?? 0) * 100)]));
  const bajos = Object.values(r.categories).flatMap((c) =>
    c.auditRefs.filter((ref) => ref.weight > 0 && r.audits[ref.id].score !== null && r.audits[ref.id].score < 0.9).map((ref) => `${c.id}:${ref.id}`),
  );
  return { ...puntajes, lcp: (r.audits["largest-contentful-paint"].numericValue / 1000).toFixed(2), bajos, url: r.finalDisplayedUrl };
}

let servidor = null;
if (!(await servidorArriba())) {
  servidor = spawn(process.execPath, [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-p", "3201"], { stdio: "ignore" });
  for (let i = 0; i < 60 && !(await servidorArriba()); i++) await new Promise((r) => setTimeout(r, 1000));
}

let fallo = false;
const medidas = {};
try {
  const cookie = await cookieDeSesion();
  const paginas = [
    ["/", null],
    ["/panel", { Cookie: cookie }],
    ["/en", null],
    ["/en/panel", { Cookie: cookie }],
  ];
  console.log(`Lighthouse móvil · ${corridas} corrida(s) por página · mediana por rendimiento`);
  console.log("página    rend  acces  b.práct  seo   LCP");
  for (const [ruta, encabezados] of paginas) {
    const todas = [];
    for (let i = 0; i < corridas; i++) todas.push(medir(`${BASE}${ruta}`, path.join(carpeta, `${ruta.replaceAll("/", "_") || "inicio"}-${i}.json`), encabezados));
    const m = [...todas].sort((a, b) => a.performance - b.performance)[Math.floor(todas.length / 2)];
    medidas[ruta] = { performance: m.performance, accessibility: m.accessibility, bestPractices: m["best-practices"], seo: m.seo, lcpSegundos: Number(m.lcp) };
    const ok = CATEGORIAS.every((c) => m[c] >= 90);
    fallo ||= !ok;
    console.log(
      `${ruta.padEnd(10)} ${String(m.performance).padStart(4)}  ${String(m.accessibility).padStart(5)}  ${String(m["best-practices"]).padStart(7)}  ${String(m.seo).padStart(4)}  ${m.lcp} s  ${ok ? "✓" : "✗"}`,
    );
    if (!m.url.endsWith(ruta)) { fallo = true; console.log(`          ✗ terminó en ${m.url}: no midió la página pedida`); }
    if (m.bajos.length) console.log(`          auditorías bajo 0,9: ${m.bajos.join(", ")}`);
  }
} finally {
  if (servidor) {
    if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(servidor.pid), "/T", "/F"], { stdio: "ignore" });
    else servidor.kill();
  }
}
mkdirSync(path.join("docs", "resultados"), { recursive: true });
writeFileSync(
  path.join("docs", "resultados", "lighthouse.json"),
  JSON.stringify(
    { fecha: new Date().toISOString(), metodo: `Lighthouse 12 móvil (throttling simulado) en Brave sin interfaz, build de producción local, mediana de ${corridas} corridas`, paginas: medidas },
    null,
    2,
  ) + "\n",
);
console.log(fallo ? "\n✗ Algún puntaje quedó por debajo de 90." : "\n✓ Los 4 puntajes ≥ 90 en todas las páginas.");
process.exit(fallo ? 1 : 0);
