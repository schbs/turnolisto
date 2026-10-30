// Datos ficticios mínimos para los tests de la agenda.
import { DateTime } from "luxon";
import { configAgenda, ZONA_CLINICA } from "@/config/clinica";
import type { Agenda, EntradaEspera, Prestacion, Turno } from "@/domain/tipos";

export const config = configAgenda;

export const consulta: Prestacion = { id: "consulta", nombre: "Consulta", duracionMin: 30 };
export const limpieza: Prestacion = { id: "limpieza", nombre: "Limpieza", duracionMin: 45 };
export const conducto: Prestacion = { id: "conducto", nombre: "Tratamiento de conducto", duracionMin: 90 };
export const prestaciones = [consulta, limpieza, conducto];

/** "2026-11-02 10:00" en hora de la clínica → ISO en UTC. */
export function local(fechaHora: string): string {
  return DateTime.fromFormat(fechaHora, "yyyy-MM-dd HH:mm", { zone: ZONA_CLINICA }).toUTC().toISO()!;
}

/** Lunes 2 de noviembre de 2026, 08:00 en la clínica. */
export const AHORA = local("2026-11-02 08:00");

export function agendaVacia(): Agenda {
  return { turnos: [], listaEspera: [] };
}

export function turno(parcial: Partial<Turno> & Pick<Turno, "id" | "inicio" | "fin">): Turno {
  return {
    pacienteId: "pac-01",
    profesionalId: "prof-a",
    prestacionId: "consulta",
    estado: "reservado",
    creadoEn: local("2026-10-30 12:00"),
    ...parcial,
  };
}

export function espera(parcial: Partial<EntradaEspera> & Pick<EntradaEspera, "id" | "creadoEn">): EntradaEspera {
  return {
    pacienteId: `pac-${parcial.id}`,
    prestacionId: "consulta",
    desde: "2026-11-01",
    hasta: "2026-11-30",
    estado: "esperando",
    ...parcial,
  };
}
