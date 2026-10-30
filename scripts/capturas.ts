// Capturas del portfolio en 1280×800 (docs/capturas/), todas con datos ficticios:
// landing, panel (resumen y agenda), una conversación simulada con respuestas reales de Gemini (grabadas) y los resultados.
// Uso: npm run build && npm run capturas   (necesita la base cargada: npm run db:seed)
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { crearModeloGrabado, type Grabacion } from "../src/agent/modelo";
import { cargarCasos, correrCaso, DIR_GRABACIONES } from "../tests/conversations/correr";

const BASE = "http://localhost:3201";
const SALIDA = path.join("docs", "capturas");
const BRAVE = process.env.BRAVE_PATH ?? path.join(process.env.LOCALAPPDATA ?? "", "BraveSoftware/Brave-Browser/Application/brave.exe");
const escapar = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

async function arriba() {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
}

const ESTILO = `
  body { margin: 0; font-family: "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif; background: #fbf6ef; color: #1f2b2e; }
  h1, h2, .titulo { font-family: "Lexend", "Segoe UI", system-ui, sans-serif; }
`;
const FUENTES = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Lexend:wght@500;600&display=swap" rel="stylesheet">`;

async function conversacion(page: Page) {
  const caso = cargarCasos().find((c) => c.nombre === "reservar")!;
  const grabacion = JSON.parse(fs.readFileSync(path.join(DIR_GRABACIONES, "reservar.json"), "utf8")) as Grabacion;
  const corrida = await correrCaso(caso, crearModeloGrabado(grabacion));
  const evento = [...corrida.deps.calendario.eventos.values()][0];

  const burbujas = corrida.pasos
    .map((p) => {
      const r = p.resultado;
      const lista =
        r.enviado?.interactivo?.tipo === "lista"
          ? `<div class="lista">☰ ${escapar(r.enviado.interactivo.boton)} · ${r.enviado.interactivo.filas.length} horarios</div>`
          : "";
      return `<div class="fila der"><div class="burbuja yo">${escapar(p.entrada)}</div></div>
        ${r.herramientas.length ? `<div class="herr">🔧 ${r.herramientas.map(escapar).join(" → ")}</div>` : ""}
        <div class="fila"><div class="burbuja bot">${escapar(r.enviado?.texto ?? "")}${lista}</div></div>`;
    })
    .join("");

  await page.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8">${FUENTES}<style>${ESTILO}
    .marco { display: grid; grid-template-columns: 420px 1fr; gap: 56px; padding: 56px 80px; height: 800px; box-sizing: border-box; }
    .tel { background: #e9e2d8; border-radius: 36px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
    .cab { background: #0e6863; color: #fff; border-radius: 22px; padding: 14px 18px; font-weight: 700; }
    .cab small { display: block; font-weight: 400; opacity: .9; }
    .fila { display: flex; } .der { justify-content: flex-end; }
    .burbuja { max-width: 82%; padding: 10px 14px; border-radius: 16px; font-size: 15px; line-height: 1.4; }
    .yo { background: #d9f0e6; border-bottom-right-radius: 4px; } .bot { background: #fff; border-bottom-left-radius: 4px; }
    .lista { margin-top: 8px; padding-top: 8px; border-top: 1px solid #e6ddd2; color: #0e6863; font-weight: 700; text-align: center; }
    .herr { align-self: center; font-size: 13px; color: #4a5a5e; background: #fff8; border-radius: 99px; padding: 4px 12px; }
    .texto h1 { font-size: 40px; margin: 40px 0 16px; line-height: 1.15; }
    .texto p { font-size: 19px; color: #4a5a5e; line-height: 1.5; }
    .evento { margin-top: 28px; background: #fff; border-radius: 18px; padding: 20px 24px; border: 1px solid #e6ddd2; font-size: 17px; }
    .evento b { color: #0e6863; }
    .nota { margin-top: 28px; font-size: 14px; color: #4a5a5e; }
  </style></head><body><div class="marco">
    <div class="tel"><div class="cab">Clínica Dental Confluencia<small>Asistente de turnos · WhatsApp</small></div>${burbujas}</div>
    <div class="texto">
      <p class="titulo" style="color:#a3412a;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-top:40px">TurnoListo</p>
      <h1>Reserva de punta a punta en dos mensajes</h1>
      <p>El agente busca horarios libres reales, ofrece opciones con una lista de WhatsApp y reserva cuando la persona elige. Cada paso pasa por reglas de dominio con tests: no hay doble reserva ni horarios fuera de agenda.</p>
      <div class="evento">📅 Evento creado en Google Calendar:<br><b>${escapar(evento.titulo)}</b></div>
      <p class="nota">Conversación simulada con respuestas reales de Gemini (grabadas). Clínica y paciente ficticios.</p>
    </div></div></body></html>`);
  await page.waitForTimeout(800);
}

async function resultados(page: Page) {
  const r = JSON.parse(fs.readFileSync(path.join("docs", "resultados", "resumen.json"), "utf8"));
  const s = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  const lh = (p: { performance: number; accessibility: number; bestPractices: number; seo: number }) => `${p.performance} · ${p.accessibility} · ${p.bestPractices} · ${p.seo}`;
  const filas = [
    ["Tests de unidad, dominio y conversaciones", `${r.tests.ok}/${r.tests.total}`],
    ["Conversaciones con Gemini en vivo", r.agente.conversacionesOk],
    ["E2E con Playwright (celular y compu)", `${r.e2e.ok}/${r.e2e.ok + r.e2e.fallidos}`],
    ["axe WCAG 2.1 AA: violaciones serias o críticas", String(r.axe.violacionesGraves)],
    ["Lighthouse móvil / (rend · acces · b. práct · SEO)", lh(r.lighthouse["/"])],
    ["Lighthouse móvil /panel (con sesión)", lh(r.lighthouse["/panel"])],
    ["Latencia del agente, mediana", s(r.agente.latenciaMs.p50)],
    ["Costo por conversación (plan pago)", `USD ${String(r.agente.costoUsd.promedioPorConversacion).replace(".", ",")}`],
  ];
  await page.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8">${FUENTES}<style>${ESTILO}
    main { padding: 64px 96px; } h1 { font-size: 40px; margin: 0 0 8px; } p { color: #4a5a5e; font-size: 18px; margin: 0 0 32px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 18px; overflow: hidden; font-size: 20px; }
    td { padding: 15px 28px; border-bottom: 1px solid #e6ddd2; } td:last-child { text-align: right; font-weight: 700; font-family: "Lexend", sans-serif; color: #0e6863; }
    tr:last-child td { border-bottom: 0; }
  </style></head><body><main>
    <h1>TurnoListo: resultados medidos</h1>
    <p>Todo medido en el repo el ${new Date(r.fecha).toLocaleDateString("es-AR")}. Demo con datos ficticios.</p>
    <table>${filas.map(([a, b]) => `<tr><td>${escapar(a)}</td><td>${escapar(b)}</td></tr>`).join("")}</table>
  </main></body></html>`);
  await page.waitForTimeout(800);
}

async function main() {
  process.loadEnvFile(".env.local");
  fs.mkdirSync(SALIDA, { recursive: true });
  let servidor: ChildProcess | null = null;
  if (!(await arriba())) {
    servidor = spawn(process.execPath, [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-p", "3201"], { stdio: "ignore" });
    for (let i = 0; i < 60 && !(await arriba()); i++) await new Promise((r) => setTimeout(r, 500));
  }
  const navegador = await chromium.launch({ executablePath: BRAVE });
  const page = await navegador.newPage({ viewport: { width: 1280, height: 800 }, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" });
  const foto = (nombre: string) => page.screenshot({ path: path.join(SALIDA, nombre) });
  try {
    await page.goto(BASE);
    await foto("01-landing.png");

    await page.goto(`${BASE}/panel/ingresar`);
    await page.getByLabel("Email").fill(process.env.PANEL_DEMO_EMAIL!);
    await page.getByLabel("Contraseña").fill(process.env.PANEL_DEMO_PASSWORD!);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.getByRole("heading", { name: "Agenda de la semana" }).waitFor();
    await page.goto(`${BASE}/panel?semana=2026-11-02`);
    await foto("02-panel-resumen.png");
    await page.locator("#titulo-agenda").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24));
    await foto("03-panel-agenda.png");

    await conversacion(page);
    await foto("04-conversacion-reserva.png");
    await resultados(page);
    await foto("05-resultados.png");
  } finally {
    await navegador.close();
    servidor?.kill();
  }
  console.log(`5 capturas en ${SALIDA}: ${fs.readdirSync(SALIDA).join(", ")}`);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
