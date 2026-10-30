// E2E con Playwright sobre el build de producción, usando Brave (ya instalado: no se descargan navegadores).
// Antes de correr, tests/e2e/preparar.ts recarga la base de Supabase con el seed.
import path from "node:path";
import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local los tests del panel fallan con un mensaje claro
}

const BRAVE = process.env.BRAVE_PATH ?? path.join(process.env.LOCALAPPDATA ?? "", "BraveSoftware/Brave-Browser/Application/brave.exe");

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/preparar.ts",
  // Los tests cambian la base compartida: uno por vez.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3201",
    launchOptions: { executablePath: BRAVE },
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  projects: [
    { name: "celular", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "compu", use: { viewport: { width: 1440, height: 900 } }, testMatch: /accesibilidad\.spec\.ts/ },
  ],
  webServer: { command: "npm run start", url: "http://localhost:3201", reuseExistingServer: true, timeout: 60_000 },
});
