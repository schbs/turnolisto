import { describe, expect, it } from "vitest";
import { esUrgencia, pideHumano } from "@/bot/reglas";
import { fechaLegible } from "@/domain/formato";
import { detectarIdioma, ruta } from "@/i18n/idioma";

describe("detectarIdioma", () => {
  it.each([
    ["Hi! I'd like to book a cleaning on Thursday afternoon", "en"],
    ["The 3:00 pm one with Dr. Ibáñez works for me", "en"],
    ["Can I cancel my appointment?", "en"],
    ["Hola! Quería sacar turno para una limpieza el jueves a la tarde", "es"],
    ["Dale, el de las 15:00 con la Dra. Ibáñez", "es"],
    ["¿Cuánto sale una limpieza?", "es"],
  ])("%s → %s", (texto, idioma) => {
    expect(detectarIdioma(texto)).toBe(idioma);
  });

  it.each(["15:00", "ok", "Tomás Herrera", "👍"])("no decide con poco texto: %s", (texto) => {
    expect(detectarIdioma(texto)).toBeNull();
  });
});

describe("reglas fijas en inglés", () => {
  it.each(["I have a severe toothache and my face is swollen", "My gum is bleeding a lot", "It's an emergency"])("urgencia: %s", (texto) => {
    expect(esUrgencia(texto)).toBe(true);
  });
  it.each(["Can I talk to a person?", "I want to speak with someone at the front desk", "human please"])("pide una persona: %s", (texto) => {
    expect(pideHumano(texto)).toBe(true);
  });
  it.each(["I'd like to book a cleaning", "Is it painful to get a filling?"])("no es urgencia ni pedido de persona: %s", (texto) => {
    expect(esUrgencia(texto)).toBe(false);
    expect(pideHumano(texto)).toBe(false);
  });
});

describe("formato y rutas por idioma", () => {
  const iso = "2026-11-05T18:00:00.000Z";
  const zona = "America/Argentina/Buenos_Aires";
  it("fecha legible en los dos idiomas", () => {
    expect(fechaLegible(iso, zona)).toBe("jueves 5/11 a las 15:00");
    expect(fechaLegible(iso, zona, "en")).toBe("Thursday, Nov 5 at 3:00 PM");
  });
  it("rutas: español sin prefijo, inglés bajo /en", () => {
    expect(ruta("es", "/panel")).toBe("/panel");
    expect(ruta("en", "/panel")).toBe("/en/panel");
    expect(ruta("en", "/")).toBe("/en");
  });
});
