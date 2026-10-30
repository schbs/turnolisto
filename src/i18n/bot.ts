// Textos fijos del bot (los que no escribe la IA) en los dos idiomas.
import clinica from "../../data/clinica.json";
import type { Idioma } from "./idioma";

const guardia = clinica.telefono_guardia.split(" (")[0];

const PRESTACIONES_EN: Record<string, string> = {
  consulta: "Check-up and diagnosis",
  limpieza: "Dental cleaning",
  arreglo: "Filling",
  extraccion: "Simple extraction",
  conducto: "Root canal",
  blanqueamiento: "Teeth whitening",
  ortodoncia: "Orthodontic check",
  urgencia: "Emergency visit",
};

/** Nombre de la prestación para mostrarle al paciente (en la base y en el prompt queda en español). */
export const nombrePrestacion = (id: string, nombre: string, idioma: Idioma) => (idioma === "en" ? (PRESTACIONES_EN[id] ?? nombre) : nombre);

export const TEXTOS_BOT = {
  es: {
    audioIlegible: "No pude escuchar bien el audio 🙏 ¿Me lo escribís?",
    tipoNoSoportado: "Por ahora solo puedo leer mensajes de texto y notas de voz. ¿Me lo escribís?",
    urgencia: `Lamento mucho el dolor. Ya le aviso a recepción para que te atiendan lo antes posible; si es urgente, llamá ahora a la guardia: ${clinica.telefono_guardia}.`,
    humano: "¡Claro! Le paso tu consulta a recepción y una persona te escribe por acá a la brevedad.",
    noEntiendo: "Perdón, no te estoy entendiendo bien. Le paso la conversación a recepción para que te ayuden.",
    fallaTecnica: "Perdón, tuve un problema técnico y no pude procesar tu mensaje. Ya le aviso a recepción para que te responda por acá.",
    reprogramarPregunta: "Dale, lo cambiamos. ¿Qué día y en qué horario te queda mejor?",
    turnoInactivo: "Ese turno ya no está activo. Si querés, te ayudo a sacar uno nuevo.",
    ofertaVencida: "Uy, ese turno ya no está disponible. Te sigo avisando si se libera otro.",
    ofertaRechazada: "¡Listo! Seguís en la lista de espera y te aviso si se libera otro horario.",
    opcionDesconocida: "No entendí esa opción. ¿Me contás qué necesitás?",
    sinEntender: "Perdón, se me complicó entenderte. ¿Me lo contás de otra forma?",
    verHorarios: "Ver horarios",
    confirmado: (prestacion: string, cuando: string) => `¡Gracias! Tu turno de ${prestacion.toLowerCase()} del ${cuando} quedó confirmado. Te esperamos 😊`,
    asignado: (prestacion: string, cuando: string, profesional: string) => `¡Listo! Te quedó el turno de ${prestacion.toLowerCase()} el ${cuando} con ${profesional}.`,
  },
  en: {
    audioIlegible: "I couldn't hear the voice note well 🙏 Could you type it?",
    tipoNoSoportado: "For now I can only read text messages and voice notes. Could you type it?",
    urgencia: `I'm so sorry you're in pain. I'm letting the front desk know so they can see you as soon as possible; if it's urgent, call the emergency line now: ${guardia}.`,
    humano: "Of course! I'm passing your message to the front desk and someone will write to you here shortly.",
    noEntiendo: "Sorry, I'm not quite understanding. I'm passing the conversation to the front desk so they can help you.",
    fallaTecnica: "Sorry, I had a technical problem and couldn't process your message. I'm letting the front desk know so they can reply here.",
    reprogramarPregunta: "Sure, let's change it. Which day and time work best for you?",
    turnoInactivo: "That appointment is no longer active. If you like, I can help you book a new one.",
    ofertaVencida: "Sorry, that slot is no longer available. I'll keep you posted if another one opens up.",
    ofertaRechazada: "Done! You're still on the waitlist and I'll let you know if another time opens up.",
    opcionDesconocida: "I didn't get that option. What do you need?",
    sinEntender: "Sorry, I'm having trouble understanding. Could you say it another way?",
    verHorarios: "See times",
    confirmado: (prestacion: string, cuando: string) => `Thank you! Your ${prestacion.toLowerCase()} appointment on ${cuando} is confirmed. See you then 😊`,
    asignado: (prestacion: string, cuando: string, profesional: string) => `Done! You're booked for ${prestacion.toLowerCase()} on ${cuando} with ${profesional}.`,
  },
} satisfies Record<Idioma, unknown>;
