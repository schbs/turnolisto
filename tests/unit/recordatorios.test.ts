import { describe, expect, it } from "vitest";
import { calcularRecordatorios, recordatoriosPendientes } from "@/domain/agenda";
import { AHORA, local, turno } from "../fixtures/agenda";

describe("recordatoriosPendientes (lo que tiene que mandar el job ahora)", () => {
  const t = turno({ id: "t1", inicio: local("2026-11-06 15:00"), fin: local("2026-11-06 15:30"), creadoEn: local("2026-10-30 12:00") });

  it("antes de las 48 h no hay nada; a las 48 h, el de 48 h", () => {
    expect(recordatoriosPendientes([t], {}, local("2026-11-04 14:59"))).toEqual({ enviar: [], saltear: [] });
    expect(recordatoriosPendientes([t], {}, local("2026-11-04 15:00")).enviar).toEqual([{ turnoId: "t1", tipo: "48h" }]);
  });

  it("no repite lo que ya se mandó", () => {
    expect(recordatoriosPendientes([t], { t1: ["48h"] }, local("2026-11-04 15:10")).enviar).toEqual([]);
  });

  it("si vencieron dos juntos (el job estuvo caído), manda solo el más cercano al turno y saltea el otro", () => {
    expect(recordatoriosPendientes([t], {}, local("2026-11-05 16:00"))).toEqual({
      enviar: [{ turnoId: "t1", tipo: "24h" }],
      saltear: [{ turnoId: "t1", tipo: "48h" }],
    });
  });

  it("no manda el de 48 h si el turno se sacó con menos anticipación", () => {
    const tarde = { ...t, creadoEn: local("2026-11-05 10:00") };
    expect(recordatoriosPendientes([tarde], {}, local("2026-11-05 16:00")).enviar).toEqual([{ turnoId: "t1", tipo: "24h" }]);
    expect(recordatoriosPendientes([tarde], {}, local("2026-11-05 16:00")).saltear).toEqual([]);
  });

  it("nada para turnos cancelados o que ya empezaron", () => {
    expect(recordatoriosPendientes([{ ...t, estado: "cancelado" }], {}, local("2026-11-06 13:00")).enviar).toEqual([]);
    expect(recordatoriosPendientes([t], {}, local("2026-11-06 15:00")).enviar).toEqual([]);
  });
});

describe("calcularRecordatorios", () => {
  it("genera recordatorios exactamente a -48 h, -24 h y -3 h del turno", () => {
    const t = turno({ id: "t1", inicio: local("2026-11-06 15:00"), fin: local("2026-11-06 15:30") });
    expect(calcularRecordatorios(t, AHORA)).toEqual([
      { turnoId: "t1", tipo: "48h", enviarEn: local("2026-11-04 15:00") },
      { turnoId: "t1", tipo: "24h", enviarEn: local("2026-11-05 15:00") },
      { turnoId: "t1", tipo: "3h", enviarEn: local("2026-11-06 12:00") },
    ]);
  });

  it("si el turno se saca con menos de 48 h, no genera el de 48 h", () => {
    const t = turno({ id: "t1", inicio: local("2026-11-03 15:00"), fin: local("2026-11-03 15:30") });
    expect(calcularRecordatorios(t, AHORA).map((r) => r.tipo)).toEqual(["24h", "3h"]);
  });

  it("un turno a menos de 3 h no genera ningún recordatorio (tampoco el de 48 h)", () => {
    const t = turno({ id: "t1", inicio: local("2026-11-02 10:30"), fin: local("2026-11-02 11:00") });
    expect(calcularRecordatorios(t, AHORA)).toEqual([]);
  });

  it("justo en el límite: a 3 h exactas el de 3 h ya no se manda", () => {
    const t = turno({ id: "t1", inicio: local("2026-11-02 11:00"), fin: local("2026-11-02 11:30") });
    expect(calcularRecordatorios(t, AHORA)).toEqual([]);
  });

  it("un turno cancelado no genera recordatorios", () => {
    const t = turno({ id: "t1", inicio: local("2026-11-06 15:00"), fin: local("2026-11-06 15:30"), estado: "cancelado" });
    expect(calcularRecordatorios(t, AHORA)).toEqual([]);
  });
});
