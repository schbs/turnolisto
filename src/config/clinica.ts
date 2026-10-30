// Datos fijos de la clínica ficticia "Clínica Dental Confluencia". Todo es de demostración.
import type { ConfigAgenda } from "@/domain/tipos";

export const ZONA_CLINICA = "America/Argentina/Buenos_Aires";

export const configAgenda: ConfigAgenda = {
  zona: ZONA_CLINICA,
  horario: {
    1: { abre: "09:00", cierra: "19:00" },
    2: { abre: "09:00", cierra: "19:00" },
    3: { abre: "09:00", cierra: "19:00" },
    4: { abre: "09:00", cierra: "19:00" },
    5: { abre: "09:00", cierra: "19:00" },
    6: { abre: "09:00", cierra: "13:00" },
    7: null,
  },
  // Solo feriados de fecha fija como ejemplo; cada clínica carga los suyos.
  feriados: ["2026-12-08", "2026-12-25", "2027-01-01"],
  intervaloMin: 15,
};
