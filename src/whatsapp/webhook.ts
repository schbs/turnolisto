// Convierte el JSON del webhook de WhatsApp Cloud API en mensajes simples. Los estados (enviado, leído…) se ignoran.
import { z } from "zod";

type Base = { id: string; de: string; nombrePerfil?: string; timestamp: number };

export type MensajeEntrante =
  | (Base & { tipo: "texto"; texto: string })
  | (Base & { tipo: "audio"; mediaId: string })
  | (Base & { tipo: "boton"; idRespuesta: string; titulo: string })
  | (Base & { tipo: "otro"; tipoOriginal: string });

const mensajeMeta = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  audio: z.object({ id: z.string() }).optional(),
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string(), title: z.string() }).optional(),
      list_reply: z.object({ id: z.string(), title: z.string(), description: z.string().optional() }).optional(),
    })
    .optional(),
  // Botón rápido de una plantilla (los recordatorios usan plantillas).
  button: z.object({ payload: z.string(), text: z.string() }).optional(),
});

const payloadMeta = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).optional() })).optional(),
            messages: z.array(z.unknown()).optional(),
          }),
        }),
      ),
    }),
  ),
});

export function parsearWebhook(cuerpo: unknown): MensajeEntrante[] {
  const payload = payloadMeta.safeParse(cuerpo);
  if (!payload.success || payload.data.object !== "whatsapp_business_account") return [];

  const salida: MensajeEntrante[] = [];
  for (const entrada of payload.data.entry) {
    for (const cambio of entrada.changes) {
      const nombres = new Map(cambio.value.contacts?.map((c) => [c.wa_id, c.profile?.name]) ?? []);
      for (const crudo of cambio.value.messages ?? []) {
        const m = mensajeMeta.safeParse(crudo);
        if (!m.success) continue;
        const base: Base = { id: m.data.id, de: m.data.from, nombrePerfil: nombres.get(m.data.from), timestamp: Number(m.data.timestamp) };
        const respuesta = m.data.interactive?.button_reply ?? m.data.interactive?.list_reply;
        if (m.data.type === "text" && m.data.text) salida.push({ ...base, tipo: "texto", texto: m.data.text.body });
        else if (m.data.type === "audio" && m.data.audio) salida.push({ ...base, tipo: "audio", mediaId: m.data.audio.id });
        else if (m.data.type === "interactive" && respuesta) salida.push({ ...base, tipo: "boton", idRespuesta: respuesta.id, titulo: respuesta.title });
        else if (m.data.type === "button" && m.data.button) salida.push({ ...base, tipo: "boton", idRespuesta: m.data.button.payload, titulo: m.data.button.text });
        else salida.push({ ...base, tipo: "otro", tipoOriginal: m.data.type });
      }
    }
  }
  return salida;
}
