import { describe, expect, it } from "vitest";
import { aWaId, normalizarTelefonoAR } from "@/domain/telefono";

describe("normalizarTelefonoAR", () => {
  it.each([
    ["+54 9 299 555-0101", "+5492995550101"],
    ["+54 299 555 0101", "+5492995550101"],
    ["5492995550101", "+5492995550101"],
    ["0299 15 555-0101", "+5492995550101"],
    ["(0299) 155-550101", "+5492995550101"],
    ["299 555 0101", "+5492995550101"],
    ["011 15 5555-0102", "+5491155550102"],
    ["11 5555-0102", "+5491155550102"],
    ["0294 15 455-0103", "+5492944550103"],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarTelefonoAR(entrada)).toBe(esperado);
  });

  it.each(["", "12345", "+1 555 0100", "abc", "0299 555 01"])("rechaza %j", (entrada) => {
    expect(normalizarTelefonoAR(entrada)).toBeNull();
  });
});

describe("aWaId", () => {
  it("saca el + para usarlo como wa_id de la API de WhatsApp", () => {
    expect(aWaId("+5492995550101")).toBe("5492995550101");
  });
});
