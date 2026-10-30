import { expect, test } from "@playwright/test";
import { ingresar, revisarAccesibilidad } from "./ayudas";

test("landing en inglés: lang, CTA, aviso de demo y axe sin violaciones graves", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your dentist appointment, on WhatsApp and with no waiting.");
  await expect(page.getByRole("link", { name: "Message us on WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/.+Hi%2C/);
  await expect(page.getByText("Demo project — fictional brand")).toBeVisible();
  await expect(page.getByText("Dental cleaning").first()).toBeVisible();
  await revisarAccesibilidad(page, "/en");
});

test("panel en inglés: ingresa, ve todo en inglés, vuelve al español y axe sin violaciones graves", async ({ page }) => {
  await page.goto("/en/panel");
  await expect(page).toHaveURL(/\/en\/panel\/ingresar$/);
  await revisarAccesibilidad(page, "/en/panel/ingresar");

  await ingresar(page, "en");
  await page.goto("/en/panel?semana=2026-11-02");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Confirmation rate", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Handoffs to handle" })).toBeVisible();
  await expect(page.getByText("Nov 2 to Nov 7, 2026")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monday, Nov 2" })).toBeVisible();
  await revisarAccesibilidad(page, "/en/panel");

  await page.getByRole("link", { name: "Español" }).click();
  await expect(page).toHaveURL(/\/panel\?semana=2026-11-02$/);
  await expect(page.getByText("2/11 al 7/11/2026")).toBeVisible();
});
