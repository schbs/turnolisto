import { expect, test } from "@playwright/test";
import { ingresar, revisarAccesibilidad } from "./ayudas";

test("landing: CTA de WhatsApp, aviso de demo y axe sin violaciones graves", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Escribinos por WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\//);
  await expect(page.getByText("Proyecto de demostración — marca ficticia")).toBeVisible();
  await revisarAccesibilidad(page, "/");
});

test("ingresar: axe sin violaciones graves", async ({ page }) => {
  await page.goto("/panel/ingresar");
  await revisarAccesibilidad(page, "/panel/ingresar");
});

test("panel: axe sin violaciones graves", async ({ page }) => {
  await ingresar(page);
  await page.goto("/panel?semana=2026-11-02");
  await revisarAccesibilidad(page, "/panel");
});
