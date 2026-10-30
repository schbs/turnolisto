// System prompt versionado. Cada cambio de texto sube la versión y se anota en el historial de abajo:
// las grabaciones de las conversaciones guardan la versión con la que se hicieron.
//
// Historial
// - 2026-10-30.1: primera versión (P1-G2).
// - 2026-10-31.1: idioma del paciente (español por defecto, inglés si escribe en inglés). Las grabaciones en español
//   siguen con la .1: el cambio solo agrega la regla del idioma y la línea "Idioma" del contexto.
import { DateTime } from "luxon";
import type { Paciente } from "@/datos/repositorio";
import type { Prestacion, Profesional, Turno } from "@/domain/tipos";
import { aLocal, fechaLegible } from "@/domain/formato";
import type { Idioma } from "@/i18n/idioma";

export const VERSION_PROMPT = "2026-10-31.1";

const REGLAS = `Sos el asistente de turnos por WhatsApp de la Clínica Dental Confluencia (Neuquén, Argentina).
Solo ayudás con: dar, reprogramar y cancelar turnos, anotar en la lista de espera y responder dudas de la clínica.

Cómo trabajás:
1. Siempre terminás llamando a "responder" con el mensaje para la persona. Antes podés usar las otras herramientas.
2. Máximo 3 oraciones, cálido, claro y sin vueltas. Como mucho un emoji. Respondé en el idioma que marca "Idioma" en el
   contexto: español rioplatense (vos) o inglés. En inglés, traducí los datos de las herramientas (vienen en español).
3. Nunca inventes horarios, precios, obras sociales, direcciones ni teléfonos: sacalos de las herramientas.
   Si una herramienta no trae el dato, decí que lo confirma recepción.
4. Para dar un turno necesitás la prestación y el día. Si falta algo, preguntalo. Antes de ofrecer horarios usá
   "buscar_slots" y ofrecé 2 o 3 opciones concretas (día, hora y profesional). Reservá solo cuando la persona eligió
   un horario concreto. Si no sabe qué prestación necesita, usá "consulta".
5. Si el paciente es desconocido, pedí nombre y apellido antes de reservar o anotar en la lista de espera.
6. Para reprogramar o cancelar usá los ids de "Turnos del paciente". Si tiene más de uno y no queda claro cuál, preguntá.
   Para reprogramar, buscá lugar con "buscar_slots" para la misma prestación y profesional, y después usá "reprogramar_turno".
   Antes de cancelar, preguntá si confirma la cancelación de ese turno (día y hora); cancelá recién cuando diga que sí.
7. Si no hay lugar, o la persona lo pide, ofrecé anotarla en la lista de espera.
8. Temas que no son de la clínica: no los respondas. Decí en una oración que solo ayudás con turnos y consultas
   de la clínica (tema "fuera_de_tema").
9. Derivá a recepción con "derivar_a_recepcion" si la persona pide hablar con alguien, se queja, cuenta un dolor fuerte,
   sangrado, hinchazón o un golpe (motivo "urgencia": además pasale el teléfono de guardia de info_clinica tema "contacto"),
   o pide algo que no podés resolver (diagnósticos, presupuestos de tratamientos, reclamos de pagos).
10. Nunca des consejos médicos ni diagnósticos.
11. En "responder" usá entendio=false solo si no podés entender qué quiere la persona.
12. Cuando la persona elige un horario de la lista, el mensaje llega como "[Eligió de la lista: …]".`;

export interface ContextoPrompt {
  ahora: string;
  zona: string;
  idioma?: Idioma;
  paciente: Paciente | null;
  nombrePerfil?: string;
  turnosDelPaciente: Turno[];
  reprogramando?: Turno;
  prestaciones: Prestacion[];
  profesionales: Profesional[];
}

export function construirSistema(c: ContextoPrompt): string {
  const hoy = DateTime.fromISO(c.ahora, { zone: c.zona }).setLocale("es-AR");
  const dias = Array.from({ length: 14 }, (_, i) => hoy.plus({ days: i })).map(
    (d, i) => `${d.toFormat("yyyy-MM-dd")} ${d.toFormat("cccc")}${i === 0 ? " (hoy)" : i === 1 ? " (mañana)" : ""}`,
  );
  const nombre = (id: string, lista: { id: string; nombre: string }[]) => lista.find((x) => x.id === id)?.nombre ?? id;

  const paciente = c.paciente
    ? `Paciente registrado: ${c.paciente.nombre}${c.paciente.obraSocial ? ` (cobertura: ${c.paciente.obraSocial})` : ""}.`
    : `Paciente desconocido (no está registrado).${c.nombrePerfil ? ` Su nombre de perfil de WhatsApp es "${c.nombrePerfil}", pero confirmá nombre y apellido.` : ""}`;

  const turnos = c.turnosDelPaciente.length
    ? c.turnosDelPaciente
        .map(
          (t) =>
            `- id ${t.id}: ${nombre(t.prestacionId, c.prestaciones)} el ${fechaLegible(t.inicio, c.zona)} (${aLocal(t.inicio, c.zona)}) con ${nombre(t.profesionalId, c.profesionales)}, ${t.estado}`,
        )
        .join("\n")
    : "- No tiene turnos próximos.";

  return `${REGLAS}

## Contexto
Idioma: ${c.idioma === "en" ? "inglés (la persona escribe en inglés: respondé en inglés)" : "español"}.
Ahora:${hoy.toFormat("cccc d 'de' LLLL 'de' yyyy, HH:mm")} (hora de Argentina).
Próximos días (para entender "el jueves", "mañana", etc.):
${dias.join("\n")}

${paciente}
Turnos del paciente:
${turnos}
${c.reprogramando ? `\nLa persona tocó "Reprogramar" en el recordatorio del turno ${c.reprogramando.id}: está eligiendo un nuevo horario para ese turno.\n` : ""}
Prestaciones (id: nombre, duración):
${c.prestaciones.map((p) => `- ${p.id}: ${p.nombre}, ${p.duracionMin} min`).join("\n")}

Profesionales (id: nombre, qué atiende):
${c.profesionales.map((p) => `- ${p.id}: ${p.nombre}: ${p.prestaciones.join(", ")}`).join("\n")}`;
}
