// Adaptador de agenda externa: el turno vive en la base; Google Calendar es un espejo para la clínica.
import { crearProveedorDeToken, type CuentaServicio } from "@/integraciones/google-auth";

export interface EventoTurno {
  titulo: string;
  descripcion: string;
  inicio: string;
  fin: string;
}

export interface Calendario {
  crear(evento: EventoTurno): Promise<string>;
  mover(eventoId: string, inicio: string, fin: string): Promise<void>;
  borrar(eventoId: string): Promise<void>;
}

export function crearCalendarioGoogle(opciones: { cuenta: CuentaServicio; calendarioId: string; zona: string }): Calendario {
  const token = crearProveedorDeToken(opciones.cuenta, "https://www.googleapis.com/auth/calendar.events");
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(opciones.calendarioId)}/events`;

  async function pedir(url: string, init: RequestInit) {
    const r = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok && !(init.method === "DELETE" && r.status === 410)) {
      const error = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(`Google Calendar respondió ${r.status}: ${error?.error?.message ?? "sin detalle"}`);
    }
    return r;
  }
  const hora = (iso: string) => ({ dateTime: iso, timeZone: opciones.zona });

  return {
    async crear(evento) {
      const r = await pedir(base, {
        method: "POST",
        body: JSON.stringify({ summary: evento.titulo, description: evento.descripcion, start: hora(evento.inicio), end: hora(evento.fin) }),
      });
      return ((await r.json()) as { id: string }).id;
    },
    async mover(eventoId, inicio, fin) {
      await pedir(`${base}/${encodeURIComponent(eventoId)}`, { method: "PATCH", body: JSON.stringify({ start: hora(inicio), end: hora(fin) }) });
    },
    async borrar(eventoId) {
      await pedir(`${base}/${encodeURIComponent(eventoId)}`, { method: "DELETE" });
    },
  };
}

/** Calendario en memoria para tests y el simulador. */
export class CalendarioFake implements Calendario {
  eventos = new Map<string, EventoTurno>();
  private siguiente = 1;

  async crear(evento: EventoTurno) {
    const id = `evt-${this.siguiente++}`;
    this.eventos.set(id, { ...evento });
    return id;
  }
  async mover(eventoId: string, inicio: string, fin: string) {
    const evento = this.eventos.get(eventoId);
    if (!evento) throw new Error(`No existe el evento ${eventoId}`);
    this.eventos.set(eventoId, { ...evento, inicio, fin });
  }
  async borrar(eventoId: string) {
    this.eventos.delete(eventoId);
  }
}
