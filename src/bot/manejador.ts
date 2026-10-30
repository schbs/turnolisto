// Manejador HTTP del webhook de WhatsApp, separado de la ruta de Next para poder probarlo con dependencias falsas.
import { firmaValida } from "@/whatsapp/firma";
import { parsearWebhook, type MensajeEntrante } from "@/whatsapp/webhook";

export interface OpcionesManejador {
  verifyToken: string;
  appSecret: string;
  procesar: (mensaje: MensajeEntrante) => Promise<unknown>;
  /** En producción: after() de Next, para responder 200 a Meta enseguida. En tests: esperar la promesa. */
  enSegundoPlano: (tarea: Promise<unknown>) => void | Promise<void>;
}

export function crearManejadorWebhook(o: OpcionesManejador) {
  return {
    /** Verificación del webhook que hace Meta al configurarlo. */
    GET(request: Request): Response {
      const p = new URL(request.url).searchParams;
      if (p.get("hub.mode") === "subscribe" && o.verifyToken && p.get("hub.verify_token") === o.verifyToken) {
        return new Response(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return new Response("Forbidden", { status: 403 });
    },

    async POST(request: Request): Promise<Response> {
      const crudo = await request.text();
      if (!firmaValida(crudo, request.headers.get("x-hub-signature-256"), o.appSecret)) return new Response("Firma inválida", { status: 401 });

      let cuerpo: unknown;
      try {
        cuerpo = JSON.parse(crudo);
      } catch {
        return new Response("JSON inválido", { status: 400 });
      }
      // Uno por uno y en orden: dos mensajes seguidos del mismo paciente no se pisan.
      const mensajes = parsearWebhook(cuerpo);
      if (mensajes.length) {
        await o.enSegundoPlano(
          (async () => {
            for (const m of mensajes) {
              try {
                await o.procesar(m);
              } catch (e) {
                console.error("[turnolisto] falló el procesamiento de un mensaje:", e instanceof Error ? e.message : e);
              }
            }
          })(),
        );
      }
      return new Response("ok", { status: 200 });
    },
  };
}
