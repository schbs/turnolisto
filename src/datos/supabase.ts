// Clientes de Supabase. El de servicio (clave secreta) saltea RLS: solo para el bot, los jobs y los scripts,
// nunca en el navegador. El panel usa el de sesión (src/app/panel/supabase-sesion.ts), que sí pasa por RLS.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let servicio: SupabaseClient | null = null;

export function supabaseServicio(): SupabaseClient {
  if (servicio) return servicio;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (ver .env.example)");
  servicio = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  return servicio;
}

export function hayEsquema(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
