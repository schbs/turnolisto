import { describe, expect, it } from "vitest";
import { cancelar, reprogramar, reservar, slotsDisponibles } from "@/domain/agenda";
import { AHORA, agendaVacia, conducto, config, consulta, espera, limpieza, local, prestaciones, turno } from "../fixtures/agenda";

const pedido = (inicio: string, extra: Partial<Parameters<typeof reservar>[1]> = {}) => ({
  id: "t-nuevo",
  pacienteId: "pac-02",
  profesionalId: "prof-a",
  prestacion: consulta,
  inicio,
  ...extra,
});

describe("reservar", () => {
  it("reserva un horario libre y calcula el fin según la prestación", () => {
    const r = reservar(agendaVacia(), pedido(local("2026-11-02 10:00"), { prestacion: limpieza }), config, AHORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.turno.fin).toBe(local("2026-11-02 10:45"));
    expect(r.turno.estado).toBe("reservado");
    expect(r.agenda.turnos).toHaveLength(1);
  });

  it("no permite doble reserva del mismo profesional, ni superpuesta", () => {
    const agenda = { ...agendaVacia(), turnos: [turno({ id: "t1", inicio: local("2026-11-02 10:00"), fin: local("2026-11-02 10:30") })] };
    expect(reservar(agenda, pedido(local("2026-11-02 10:00")), config, AHORA)).toEqual({ ok: false, error: "turno_ocupado" });
    expect(reservar(agenda, pedido(local("2026-11-02 10:15")), config, AHORA)).toEqual({ ok: false, error: "turno_ocupado" });
    expect(reservar(agenda, pedido(local("2026-11-02 09:45"), { prestacion: limpieza }), config, AHORA)).toEqual({
      ok: false,
      error: "turno_ocupado",
    });
  });

  it("permite el mismo horario con otro profesional, o pegado al turno anterior", () => {
    const agenda = { ...agendaVacia(), turnos: [turno({ id: "t1", inicio: local("2026-11-02 10:00"), fin: local("2026-11-02 10:30") })] };
    expect(reservar(agenda, pedido(local("2026-11-02 10:00"), { profesionalId: "prof-b" }), config, AHORA).ok).toBe(true);
    expect(reservar(agenda, pedido(local("2026-11-02 10:30")), config, AHORA).ok).toBe(true);
  });

  it("un paciente no puede tener dos turnos superpuestos, aunque sean con distintos profesionales", () => {
    const agenda = { ...agendaVacia(), turnos: [turno({ id: "t1", pacienteId: "pac-02", inicio: local("2026-11-02 10:00"), fin: local("2026-11-02 10:45") })] };
    expect(reservar(agenda, pedido(local("2026-11-02 10:30"), { profesionalId: "prof-b" }), config, AHORA)).toEqual({ ok: false, error: "paciente_ocupado" });
    expect(reservar(agenda, pedido(local("2026-11-02 10:45"), { profesionalId: "prof-b" }), config, AHORA).ok).toBe(true);
  });

  it("reprogramar tampoco puede encimar el turno con otro del mismo paciente", () => {
    const agenda = {
      ...agendaVacia(),
      turnos: [
        turno({ id: "t1", pacienteId: "pac-02", inicio: local("2026-11-03 10:00"), fin: local("2026-11-03 10:30") }),
        turno({ id: "t2", pacienteId: "pac-02", profesionalId: "prof-b", inicio: local("2026-11-04 10:00"), fin: local("2026-11-04 10:30") }),
      ],
    };
    expect(reprogramar(agenda, "t1", local("2026-11-04 10:15"), config, AHORA)).toEqual({ ok: false, error: "paciente_ocupado" });
  });

  it("un turno cancelado no ocupa el horario", () => {
    const agenda = {
      ...agendaVacia(),
      turnos: [turno({ id: "t1", inicio: local("2026-11-02 10:00"), fin: local("2026-11-02 10:30"), estado: "cancelado" })],
    };
    expect(reservar(agenda, pedido(local("2026-11-02 10:00")), config, AHORA).ok).toBe(true);
  });

  it("no reserva fuera de horario: antes de abrir, terminando después de cerrar ni el sábado a la tarde", () => {
    expect(reservar(agendaVacia(), pedido(local("2026-11-02 08:30")), config, AHORA)).toEqual({ ok: false, error: "fuera_de_horario" });
    expect(reservar(agendaVacia(), pedido(local("2026-11-02 18:00"), { prestacion: conducto }), config, AHORA)).toEqual({
      ok: false,
      error: "fuera_de_horario",
    });
    expect(reservar(agendaVacia(), pedido(local("2026-11-07 13:00")), config, AHORA)).toEqual({ ok: false, error: "fuera_de_horario" });
    expect(reservar(agendaVacia(), pedido(local("2026-11-07 12:30")), config, AHORA).ok).toBe(true);
  });

  it("no reserva el domingo, en un feriado configurado ni en el pasado", () => {
    expect(reservar(agendaVacia(), pedido(local("2026-11-08 10:00")), config, AHORA)).toEqual({ ok: false, error: "dia_sin_atencion" });
    expect(reservar(agendaVacia(), pedido(local("2026-12-08 10:00")), config, AHORA)).toEqual({ ok: false, error: "feriado" });
    expect(reservar(agendaVacia(), pedido(local("2026-10-30 10:00")), config, AHORA)).toEqual({ ok: false, error: "en_el_pasado" });
  });

  it("no reserva en un horario que no cae en la grilla de 15 minutos", () => {
    expect(reservar(agendaVacia(), pedido(local("2026-11-02 10:10")), config, AHORA)).toEqual({ ok: false, error: "fuera_de_horario" });
  });
});

describe("slotsDisponibles", () => {
  it("lista los horarios libres de un día y saltea los ocupados", () => {
    const agenda = { ...agendaVacia(), turnos: [turno({ id: "t1", inicio: local("2026-11-02 09:30"), fin: local("2026-11-02 10:00") })] };
    const slots = slotsDisponibles(agenda, { fecha: "2026-11-02", profesionalId: "prof-a", prestacion: consulta }, config, AHORA);
    expect(slots[0]).toBe(local("2026-11-02 09:00"));
    expect(slots).not.toContain(local("2026-11-02 09:15"));
    expect(slots).not.toContain(local("2026-11-02 09:30"));
    expect(slots).toContain(local("2026-11-02 10:00"));
    expect(slots.at(-1)).toBe(local("2026-11-02 18:30"));
  });

  it("no ofrece horarios en feriados, domingos ni ya pasados", () => {
    const base = { profesionalId: "prof-a", prestacion: consulta };
    expect(slotsDisponibles(agendaVacia(), { ...base, fecha: "2026-12-25" }, config, AHORA)).toEqual([]);
    expect(slotsDisponibles(agendaVacia(), { ...base, fecha: "2026-11-08" }, config, AHORA)).toEqual([]);
    const tarde = local("2026-11-02 17:50");
    expect(slotsDisponibles(agendaVacia(), { ...base, fecha: "2026-11-02" }, config, tarde)).toEqual([
      local("2026-11-02 18:00"),
      local("2026-11-02 18:15"),
      local("2026-11-02 18:30"),
    ]);
  });
});

describe("reprogramar", () => {
  const agenda = () => ({
    ...agendaVacia(),
    turnos: [turno({ id: "t1", inicio: local("2026-11-03 10:00"), fin: local("2026-11-03 10:45"), prestacionId: "limpieza" })],
  });

  it("mueve el turno, conserva la duración y libera el horario anterior", () => {
    const r = reprogramar(agenda(), "t1", local("2026-11-04 15:00"), config, AHORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.turno.inicio).toBe(local("2026-11-04 15:00"));
    expect(r.turno.fin).toBe(local("2026-11-04 15:45"));
    expect(r.turno.estado).toBe("reservado");
    const otro = reservar(r.agenda, pedido(local("2026-11-03 10:00")), config, AHORA);
    expect(otro.ok).toBe(true);
  });

  it("puede correrse dentro de su propio horario sin chocar consigo mismo", () => {
    expect(reprogramar(agenda(), "t1", local("2026-11-03 10:15"), config, AHORA).ok).toBe(true);
  });

  it("rechaza un horario ocupado, un turno inexistente o uno cancelado", () => {
    const a = agenda();
    a.turnos.push(turno({ id: "t2", inicio: local("2026-11-04 15:00"), fin: local("2026-11-04 15:30") }));
    a.turnos.push(turno({ id: "t3", inicio: local("2026-11-05 15:00"), fin: local("2026-11-05 15:30"), estado: "cancelado" }));
    expect(reprogramar(a, "t1", local("2026-11-04 15:00"), config, AHORA)).toEqual({ ok: false, error: "turno_ocupado" });
    expect(reprogramar(a, "nada", local("2026-11-04 16:00"), config, AHORA)).toEqual({ ok: false, error: "turno_inexistente" });
    expect(reprogramar(a, "t3", local("2026-11-04 16:00"), config, AHORA)).toEqual({ ok: false, error: "turno_no_activo" });
  });
});

describe("cancelar y lista de espera", () => {
  const conTurno = () => ({
    turnos: [turno({ id: "t1", inicio: local("2026-11-04 10:00"), fin: local("2026-11-04 10:45"), prestacionId: "limpieza" })],
    listaEspera: [
      espera({ id: "e-tarde", creadoEn: local("2026-10-29 09:00") }),
      espera({ id: "e-primero", creadoEn: local("2026-10-20 09:00") }),
      espera({ id: "e-segundo", creadoEn: local("2026-10-25 09:00") }),
    ],
  });

  it("cancelar marca el turno y ofrece el hueco al primero que llegó a la lista", () => {
    const r = cancelar(conTurno(), "t1", prestaciones, config, AHORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.agenda.turnos[0].estado).toBe("cancelado");
    expect(r.oferta).toEqual({
      entradaId: "e-primero",
      pacienteId: "pac-e-primero",
      profesionalId: "prof-a",
      prestacionId: "consulta",
      inicio: local("2026-11-04 10:00"),
    });
    expect(r.agenda.listaEspera.find((e) => e.id === "e-primero")?.estado).toBe("ofrecido");
    expect(r.agenda.listaEspera.find((e) => e.id === "e-segundo")?.estado).toBe("esperando");
  });

  it("saltea a quien no le sirve: otra fecha, otro profesional, prestación más larga o ya ofrecido", () => {
    const agenda = conTurno();
    agenda.listaEspera = [
      espera({ id: "e-fecha", creadoEn: local("2026-10-10 09:00"), desde: "2026-11-10", hasta: "2026-11-20" }),
      espera({ id: "e-prof", creadoEn: local("2026-10-11 09:00"), profesionalId: "prof-b" }),
      espera({ id: "e-largo", creadoEn: local("2026-10-12 09:00"), prestacionId: "conducto" }),
      espera({ id: "e-ofrecido", creadoEn: local("2026-10-13 09:00"), estado: "ofrecido" }),
      espera({ id: "e-ok", creadoEn: local("2026-10-14 09:00"), prestacionId: "limpieza", profesionalId: "prof-a" }),
    ];
    const r = cancelar(agenda, "t1", prestaciones, config, AHORA);
    expect(r.ok && r.oferta?.entradaId).toBe("e-ok");
  });

  it("si nadie de la lista puede, no hay oferta; y no se cancela dos veces", () => {
    const agenda = { ...conTurno(), listaEspera: [] };
    const r = cancelar(agenda, "t1", prestaciones, config, AHORA);
    expect(r.ok && r.oferta).toBeNull();
    if (!r.ok) return;
    expect(cancelar(r.agenda, "t1", prestaciones, config, AHORA)).toEqual({ ok: false, error: "turno_no_activo" });
  });

  it("un turno que ya pasó no se ofrece a la lista de espera", () => {
    const despues = local("2026-11-04 11:00");
    const r = cancelar(conTurno(), "t1", prestaciones, config, despues);
    expect(r.ok && r.oferta).toBeNull();
  });
});

describe("no modifica la agenda recibida", () => {
  it("reservar devuelve una agenda nueva", () => {
    const original = agendaVacia();
    reservar(original, pedido(local("2026-11-02 10:00")), config, AHORA);
    expect(original.turnos).toHaveLength(0);
  });
});
