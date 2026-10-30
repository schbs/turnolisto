import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Ingresa con el usuario demo de recepción (credenciales de .env.local, creadas por npm run db:seed). */
export async function ingresar(page: Page) {
  const email = process.env.PANEL_DEMO_EMAIL;
  const password = process.env.PANEL_DEMO_PASSWORD;
  if (!email || !password) throw new Error("Faltan PANEL_DEMO_EMAIL / PANEL_DEMO_PASSWORD: correr npm run db:seed");
  await page.goto("/panel/ingresar");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Agenda de la semana" })).toBeVisible();
}

/** axe con reglas WCAG 2.1 AA: no tiene que haber violaciones serias ni críticas. Devuelve el resumen. */
export async function revisarAccesibilidad(page: Page, nombre: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const resumen = `${nombre}: ${r.passes.length} reglas OK, ${r.violations.length} violaciones (${graves.length} serias o críticas)`;
  console.log(`  axe → ${resumen}`);
  expect(graves.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  return resumen;
}
