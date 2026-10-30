// Tipos del dominio de la agenda. Las fechas viajan como ISO en UTC; la zona horaria de la clínica vive en ConfigAgenda.

export type EstadoTurno = "reservado" | "confirmado" | "cancelado" | "ausente";

export interface Prestacion {
  id: string;
  nombre: string;
  duracionMin: number;
}

export interface Profesional {
  id: string;
  nombre: string;
  prestaciones: string[];
}

export interface Turno {
  id: string;
  pacienteId: string;
  profesionalId: string;
  prestacionId: string;
  inicio: string;
  fin: string;
  estado: EstadoTurno;
  creadoEn: string;
}

export type EstadoEspera = "esperando" | "ofrecido" | "asignado" | "vencido";

export interface EntradaEspera {
  id: string;
  pacienteId: string;
  prestacionId: string;
  /** Si el paciente quiere un profesional en particular; si no, cualquiera. */
  profesionalId?: string;
  /** Rango de fechas locales (YYYY-MM-DD) en el que le sirve un turno. */
  desde: string;
  hasta: string;
  creadoEn: string;
  estado: EstadoEspera;
}

export interface Agenda {
  turnos: Turno[];
  listaEspera: EntradaEspera[];
}

/** Horario de un día en hora local ("09:00"). null = ese día no se atiende. */
export type HorarioDia = { abre: string; cierra: string } | null;

export interface ConfigAgenda {
  zona: string;
  /** Clave: día de la semana ISO (1 = lunes … 7 = domingo). */
  horario: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, HorarioDia>;
  /** Fechas locales (YYYY-MM-DD) sin atención. */
  feriados: string[];
  /** Cada cuántos minutos arranca un turno posible. */
  intervaloMin: number;
}

export type ErrorAgenda =
  | "turno_ocupado"
  | "paciente_ocupado"
  | "fuera_de_horario"
  | "dia_sin_atencion"
  | "feriado"
  | "en_el_pasado"
  | "turno_inexistente"
  | "turno_no_activo";

export type Resultado<T> = ({ ok: true } & T) | { ok: false; error: ErrorAgenda };

export type TipoRecordatorio = "48h" | "24h" | "3h";

export interface Recordatorio {
  turnoId: string;
  tipo: TipoRecordatorio;
  enviarEn: string;
}

export interface Oferta {
  entradaId: string;
  pacienteId: string;
  profesionalId: string;
  prestacionId: string;
  inicio: string;
}
