// Job de recordatorios: lo llama un programador cada 15 minutos (n8n o Vercel Cron) con
// "Authorization: Bearer <CRON_SECRET>". Es idempotente: llamarlo de más no manda nada repetido.
import { dependenciasReales } from "@/bot/dependencias";
import { correrRecordatorios } from "@/bot/recordatorios";

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) return new Response("No autorizado", { status: 401 });

  const resultado = await correrRecordatorios(await dependenciasReales(), {
    plantilla: process.env.WHATSAPP_PLANTILLA_RECORDATORIO || undefined,
  });
  return Response.json({
    enviados: resultado.enviados.length,
    salteados: resultado.salteados,
    sin_permiso: resultado.sinPermiso,
    fallidos: resultado.fallidos.length,
  });
}
