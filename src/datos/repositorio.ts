// Acceso a los datos del bot. Por ahora hay una versión en memoria cargada desde data/seed;
// la de Supabase llega con el panel (P1-G3) y respeta esta misma interfaz.
import pacientesSeed from "../../data/seed/pacientes.json";
import prestacionesSeed from "../../data/seed/prestaciones.json";
import profesionalesSeed from "../../data/seed/profesionales.json";
import turnosSeed from "../../data/seed/turnos.json";
import esperaSeed from "../../data/seed/lista_espera.json";
import type { Agenda, EntradaEspera, Oferta, Prestacion, Profesional, TipoRecordatorio, Turno } from "@/domain/tipos";
import type { Idioma } from "@/i18n/idioma";

export interface Paciente {
  id: string;
  nombre: string;
  /** E.164: +549… */
  telefono: string;
  email?: string;
  obraSocial?: string;
  optInWhatsapp: boolean;
}

export interface EstadoConversacion {
  telefono: string;
  historial: { rol: "usuario" | "asistente"; texto: string }[];
  /** Respuestas seguidas en las que el agente no entendió. A la segunda, se deriva. */
  fallos: number;
  /** Después de una derivación el bot no contesta hasta que recepción la cierre. */
  pausado: boolean;
  /** Turno que el paciente pidió reprogramar con el botón del recordatorio. */
  reprogramando?: string;
  /** Idioma en el que escribe el paciente (sin dato: español). */
  idioma?: Idioma;
}

export type MotivoHandoff = "pedido_del_paciente" | "queja" | "urgencia" | "no_entiendo" | "otro";

export interface Handoff {
  id: string;
  telefono: string;
  pacienteId?: string;
  motivo: MotivoHandoff;
  resumen: string;
  estado: "pendiente" | "en_curso" | "resuelto";
  creadoEn: string;
}

export interface RegistroMensaje {
  telefono: string;
  direccion: "entrante" | "saliente";
  tipo: string;
  texto: string;
  creadoEn: string;
}

export interface Repositorio {
  prestaciones(): Prestacion[];
  profesionales(): Profesional[];
  pacientePorTelefono(telefono: string): Promise<Paciente | null>;
  paciente(id: string): Promise<Paciente | null>;
  crearPaciente(datos: Omit<Paciente, "id">): Promise<Paciente>;
  agenda(): Promise<Agenda>;
  guardarAgenda(agenda: Agenda): Promise<void>;
  eventoDeTurno(turnoId: string): Promise<string | null>;
  guardarEventoDeTurno(turnoId: string, eventoId: string): Promise<void>;
  /** true si el mensaje es nuevo; false si ya se había procesado (Meta reenvía). */
  marcarMensajeProcesado(mensajeId: string): Promise<boolean>;
  conversacion(telefono: string): Promise<EstadoConversacion>;
  guardarConversacion(estado: EstadoConversacion): Promise<void>;
  registrarHandoff(datos: Omit<Handoff, "id" | "estado">): Promise<Handoff>;
  handoffs(): Promise<Handoff[]>;
  guardarOferta(oferta: Oferta): Promise<void>;
  oferta(entradaId: string): Promise<Oferta | null>;
  registrarMensaje(registro: RegistroMensaje): Promise<void>;
  mensajes(telefono?: string): Promise<RegistroMensaje[]>;
  /** Id nuevo para un turno, una entrada de lista de espera o un paciente. */
  nuevoId(tipo: "tur" | "esp" | "pac"): Promise<string>;
  /** Recordatorios ya enviados (o salteados) por turno. */
  recordatoriosEnviados(turnoIds: string[]): Promise<Record<string, TipoRecordatorio[]>>;
  /** Reclama el recordatorio: true solo para quien lo marcó primero (así dos corridas del job no lo mandan dos veces). */
  marcarRecordatorio(turnoId: string, tipo: TipoRecordatorio, cuando: string): Promise<boolean>;
  /** Deshace la marca si el envío falló, para que la próxima corrida lo reintente. */
  liberarRecordatorio(turnoId: string, tipo: TipoRecordatorio): Promise<void>;
}

const copia = <T>(x: T): T => structuredClone(x);

export class RepositorioMemoria implements Repositorio {
  private _prestaciones: Prestacion[] = prestacionesSeed.map(({ id, nombre, duracionMin }) => ({ id, nombre, duracionMin }));
  private _profesionales: Profesional[] = profesionalesSeed.map(({ id, nombre, prestaciones }) => ({ id, nombre, prestaciones }));
  private _pacientes: Paciente[] = copia(pacientesSeed);
  private _agenda: Agenda = { turnos: copia(turnosSeed) as Turno[], listaEspera: copia(esperaSeed) as EntradaEspera[] };
  private _eventos = new Map<string, string>();
  private _procesados = new Set<string>();
  private _conversaciones = new Map<string, EstadoConversacion>();
  private _handoffs: Handoff[] = [];
  private _ofertas = new Map<string, Oferta>();
  private _mensajes: RegistroMensaje[] = [];
  private _recordatorios = new Map<string, TipoRecordatorio[]>();

  async nuevoId(tipo: "tur" | "esp" | "pac") {
    // Secuencial y determinista (los tests lo necesitan): el siguiente número después de la cantidad actual.
    const cantidad = tipo === "tur" ? this._agenda.turnos.length : tipo === "esp" ? this._agenda.listaEspera.length : this._pacientes.length;
    return `${tipo}-${String(cantidad + 1).padStart(3, "0")}`;
  }
  async recordatoriosEnviados(turnoIds: string[]) {
    return Object.fromEntries(turnoIds.map((id) => [id, [...(this._recordatorios.get(id) ?? [])]]));
  }
  async marcarRecordatorio(turnoId: string, tipo: TipoRecordatorio) {
    const marcados = this._recordatorios.get(turnoId) ?? [];
    if (marcados.includes(tipo)) return false;
    this._recordatorios.set(turnoId, [...marcados, tipo]);
    return true;
  }
  async liberarRecordatorio(turnoId: string, tipo: TipoRecordatorio) {
    this._recordatorios.set(turnoId, (this._recordatorios.get(turnoId) ?? []).filter((t) => t !== tipo));
  }

  prestaciones() {
    return this._prestaciones;
  }
  profesionales() {
    return this._profesionales;
  }
  async pacientePorTelefono(telefono: string) {
    return copia(this._pacientes.find((p) => p.telefono === telefono) ?? null);
  }
  async paciente(id: string) {
    return copia(this._pacientes.find((p) => p.id === id) ?? null);
  }
  async crearPaciente(datos: Omit<Paciente, "id">) {
    const paciente = { id: await this.nuevoId("pac"), ...datos };
    this._pacientes.push(paciente);
    return copia(paciente);
  }
  async agenda() {
    return copia(this._agenda);
  }
  async guardarAgenda(agenda: Agenda) {
    this._agenda = copia(agenda);
  }
  async eventoDeTurno(turnoId: string) {
    return this._eventos.get(turnoId) ?? null;
  }
  async guardarEventoDeTurno(turnoId: string, eventoId: string) {
    this._eventos.set(turnoId, eventoId);
  }
  async marcarMensajeProcesado(mensajeId: string) {
    if (this._procesados.has(mensajeId)) return false;
    this._procesados.add(mensajeId);
    return true;
  }
  async conversacion(telefono: string) {
    return copia(this._conversaciones.get(telefono) ?? { telefono, historial: [], fallos: 0, pausado: false });
  }
  async guardarConversacion(estado: EstadoConversacion) {
    this._conversaciones.set(estado.telefono, copia(estado));
  }
  async registrarHandoff(datos: Omit<Handoff, "id" | "estado">) {
    const handoff: Handoff = { id: `hnd-${this._handoffs.length + 1}`, estado: "pendiente", ...datos };
    this._handoffs.push(handoff);
    return copia(handoff);
  }
  async handoffs() {
    return copia(this._handoffs);
  }
  async guardarOferta(oferta: Oferta) {
    this._ofertas.set(oferta.entradaId, copia(oferta));
  }
  async oferta(entradaId: string) {
    return copia(this._ofertas.get(entradaId) ?? null);
  }
  async registrarMensaje(registro: RegistroMensaje) {
    this._mensajes.push(copia(registro));
  }
  async mensajes(telefono?: string) {
    return copia(telefono ? this._mensajes.filter((m) => m.telefono === telefono) : this._mensajes);
  }
}
