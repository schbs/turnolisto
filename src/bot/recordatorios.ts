// Job de recordatorios (48 h, 24 h y 3 h antes). Se puede correr seguido (cada 15 min) sin mandar nada dos veces:
// cada recordatorio se "reclama" en la base antes de enviarse y se libera si el envío falla.
import { recordatoriosPendientes } from "@/domain/agenda";
import { fechaLegible } from "@/domain/formato";
import type { TipoRecordatorio } from "@/domain/tipos";
import type { DepsHerramientas } from "@/agent/herramientas";
import { DestinoNoPermitido, type MensajeSaliente } from "@/whatsapp/mensajero";

export interface OpcionesRecordatorios {
  /** Nombre de la plantilla aprobada en Meta. Sin plantilla se manda un mensaje con botones (solo llega dentro de la ventana de 24 h). */
  plantilla?: string;
  idioma?: string;
}

export interface ResultadoRecordatorios {
  enviados: { turnoId: string; tipo: TipoRecordatorio }[];
  salteados: number;
  sinPermiso: number;
  fallidos: { turnoId: string; tipo: TipoRecordatorio; error: string }[];
}

const nombreDe = (lista: { id: string; nombre: string }[], id: string) => lista.find((x) => x.id === id)?.nombre ?? id;

export async function correrRecordatorios(deps: DepsHerramientas, opciones: OpcionesRecordatorios = {}): Promise<ResultadoRecordatorios> {
  const { repo, config } = deps;
  const ahora = deps.ahora();
  const limite = Date.parse(ahora) + 49 * 3600_000;
  const agenda = await repo.agenda();
  const proximos = agenda.turnos.filter((t) => Date.parse(t.inicio) > Date.parse(ahora) && Date.parse(t.inicio) <= limite);
  const enviados = await repo.recordatoriosEnviados(proximos.map((t) => t.id));
  const { enviar, saltear } = recordatoriosPendientes(proximos, enviados, ahora);

  const resultado: ResultadoRecordatorios = { enviados: [], salteados: 0, sinPermiso: 0, fallidos: [] };
  for (const s of saltear) if (await repo.marcarRecordatorio(s.turnoId, s.tipo, ahora)) resultado.salteados++;

  for (const { turnoId, tipo } of enviar) {
    const turno = proximos.find((t) => t.id === turnoId)!;
    const paciente = await repo.paciente(turno.pacienteId);
    if (!paciente?.optInWhatsapp) {
      // Sin consentimiento para WhatsApp no se escribe; se marca para no volver a evaluarlo.
      await repo.marcarRecordatorio(turnoId, tipo, ahora);
      resultado.sinPermiso++;
      continue;
    }
    if (!(await repo.marcarRecordatorio(turnoId, tipo, ahora))) continue; // otra corrida ya lo tomó

    const prestacion = nombreDe(repo.prestaciones(), turno.prestacionId).toLowerCase();
    const profesional = nombreDe(repo.profesionales(), turno.profesionalId);
    const cuando = fechaLegible(turno.inicio, config.zona);
    const nombre = paciente.nombre.split(" ")[0];
    const botones = [`confirmar|${turno.id}`, `reprogramar|${turno.id}`];
    const mensaje: MensajeSaliente = {
      para: paciente.telefono.replace(/^\+/, ""),
      texto: `¡Hola, ${nombre}! Te recordamos tu turno de ${prestacion} el ${cuando} con ${profesional} en Clínica Dental Confluencia. ¿Confirmás que venís?`,
      ...(opciones.plantilla
        ? { plantilla: { nombre: opciones.plantilla, idioma: opciones.idioma ?? "es_AR", parametros: [nombre, prestacion, cuando, profesional], botones } }
        : {
            interactivo: {
              tipo: "botones" as const,
              botones: [
                { id: botones[0], titulo: "Confirmo" },
                { id: botones[1], titulo: "Reprogramar" },
              ],
            },
          }),
    };
    try {
      await deps.mensajero.enviar(mensaje);
      await repo.registrarMensaje({ telefono: paciente.telefono, direccion: "saliente", tipo: `recordatorio_${tipo}`, texto: mensaje.texto, creadoEn: ahora });
      resultado.enviados.push({ turnoId, tipo });
    } catch (e) {
      if (e instanceof DestinoNoPermitido) {
        // Modo demo: queda marcado y no se reintenta.
        resultado.sinPermiso++;
        continue;
      }
      await repo.liberarRecordatorio(turnoId, tipo);
      resultado.fallidos.push({ turnoId, tipo, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return resultado;
}
