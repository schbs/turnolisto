// Webhook de WhatsApp Cloud API: GET verifica la suscripción, POST recibe mensajes (con firma X-Hub-Signature-256).
import { after } from "next/server";
import { dependenciasReales } from "@/bot/dependencias";
import { crearManejadorWebhook } from "@/bot/manejador";
import { procesarMensaje } from "@/bot/procesar";

const manejador = () =>
  crearManejadorWebhook({
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
    appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
    procesar: async (m) => procesarMensaje(m, await dependenciasReales()),
    // Meta espera un 200 rápido: el mensaje se procesa después de responder.
    enSegundoPlano: (tarea) => after(tarea),
  });

export function GET(request: Request) {
  return manejador().GET(request);
}

export function POST(request: Request) {
  return manejador().POST(request);
}
