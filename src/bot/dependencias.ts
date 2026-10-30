// Dependencias reales del bot, armadas desde las variables de entorno (solo del lado del servidor).
import { crearModeloGemini } from "@/agent/modelo";
import { crearTranscriptorGroq } from "@/audio/transcriptor";
import { crearCalendarioGoogle } from "@/calendario/calendario";
import { configAgenda } from "@/config/clinica";
import { RepositorioMemoria } from "@/datos/repositorio";
import { RepositorioSupabase } from "@/datos/repositorio-supabase";
import { hayEsquema } from "@/datos/supabase";
import { descargarMedia } from "@/whatsapp/media";
import { crearMensajeroCloudApi } from "@/whatsapp/mensajero";
import type { DepsBot } from "./procesar";

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre} (ver .env.example)`);
  return valor;
}

/** WHATSAPP_DESTINOS_PERMITIDOS vacía = sin restricción (producción). En la demo: solo los celulares de prueba. */
function destinosPermitidos(): string[] | undefined {
  const lista = (process.env.WHATSAPP_DESTINOS_PERMITIDOS ?? "")
    .split(",")
    .map((n) => n.trim().replace(/^\+/, ""))
    .filter(Boolean);
  return lista.length ? lista : undefined;
}

let deps: Promise<DepsBot> | null = null;

/** Una sola instancia por proceso. Con Supabase configurado guarda en la base; si no, en memoria (solo para probar). */
export function dependenciasReales(): Promise<DepsBot> {
  deps ??= armar().catch((e) => {
    deps = null; // que el próximo mensaje lo vuelva a intentar
    throw e;
  });
  return deps;
}

async function armar(): Promise<DepsBot> {
  const token = requerida("WHATSAPP_TOKEN");
  return {
    repo: hayEsquema() ? await RepositorioSupabase.crear() : new RepositorioMemoria(),
    config: configAgenda,
    ahora: () => new Date().toISOString(),
    modelo: crearModeloGemini({ apiKey: requerida("GEMINI_API_KEY"), modelo: process.env.GEMINI_MODEL || undefined }),
    mensajero: crearMensajeroCloudApi({
      token,
      phoneNumberId: requerida("WHATSAPP_PHONE_NUMBER_ID"),
      permitidos: destinosPermitidos(),
    }),
    calendario: crearCalendarioGoogle({
      cuenta: { email: requerida("GOOGLE_SERVICE_ACCOUNT_EMAIL"), clavePrivada: requerida("GOOGLE_PRIVATE_KEY") },
      calendarioId: requerida("GOOGLE_CALENDAR_ID"),
      zona: configAgenda.zona,
    }),
    transcriptor: crearTranscriptorGroq({ apiKey: requerida("GROQ_API_KEY"), descargar: (id) => descargarMedia(id, token) }),
    remitentesPermitidos: destinosPermitidos(),
  };
}
