import { expect, test } from "@playwright/test";
import { ingresar } from "./ayudas";

test("sin sesión, /panel manda a ingresar", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/panel\/ingresar$/);
});

test("contraseña incorrecta: avisa con un error anunciado", async ({ page }) => {
  await page.goto("/panel/ingresar");
  await page.getByLabel("Email").fill(process.env.PANEL_DEMO_EMAIL ?? "recepcion.demo@example.com");
  await page.getByLabel("Contraseña").fill("no-es-la-clave");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.locator("#error-ingreso")).toContainText("no coinciden");
});

test("login demo: ve el resumen, la cola de derivaciones y la agenda semanal", async ({ page }) => {
  await ingresar(page);
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  await expect(page.getByText("Confirmación", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Derivaciones para atender" })).toBeVisible();
  await page.goto("/panel?semana=2026-11-02");
  await expect(page.getByText("2/11 al 7/11/2026")).toBeVisible();
  await expect(page.locator("[data-turno]").first()).toBeVisible();
});

test("resolver una derivación la saca de la cola", async ({ page }) => {
  await ingresar(page);
  const derivaciones = page.locator("[data-derivacion]");
  const antes = await derivaciones.count();
  expect(antes).toBeGreaterThan(0);
  await derivaciones.first().getByRole("button", { name: /Marcar resuelta/ }).click();
  await expect(derivaciones).toHaveCount(antes - 1);
});

test("confirmar un turno reservado cambia su estado y su color", async ({ page }) => {
  await ingresar(page);
  await page.goto("/panel?semana=2026-11-02");
  const reservado = page.locator('[data-estado="reservado"]').first();
  const id = await reservado.getAttribute("data-turno");
  const colorAntes = await reservado.getByText("Reservado").evaluate((el) => getComputedStyle(el.closest("span")!).backgroundColor);

  await reservado.getByRole("button", { name: /Confirmar/ }).click();

  const turno = page.locator(`[data-turno="${id}"]`);
  await expect(turno).toHaveAttribute("data-estado", "confirmado");
  const colorDespues = await turno.getByText("Confirmado").evaluate((el) => getComputedStyle(el.closest("span")!).backgroundColor);
  expect(colorDespues).not.toBe(colorAntes);
  console.log(`  ${id}: ${colorAntes} → ${colorDespues}`);
});
