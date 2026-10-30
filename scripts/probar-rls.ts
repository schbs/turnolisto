// Comprueba la seguridad por filas (RLS) contra Supabase: sin sesión no se ve nada y el usuario de recepción
// (staff) ve todo pero no puede borrar. Uso: npm run probar-rls
import { createClient } from "@supabase/supabase-js";

async function main() {
  process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publica = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cliente = () => createClient(url, publica, { auth: { persistSession: false } });
  const contar = async (c: ReturnType<typeof cliente>) => {
    const r = await Promise.all(["turnos", "pacientes", "handoffs", "mensajes"].map((t) => c.from(t).select("*", { count: "exact", head: true })));
    return r.map((x) => x.count ?? 0).join("/");
  };

  console.log(`sin sesión (clave pública)      turnos/pacientes/derivaciones/mensajes: ${await contar(cliente())}`);

  const recepcion = cliente();
  const { error } = await recepcion.auth.signInWithPassword({ email: process.env.PANEL_DEMO_EMAIL!, password: process.env.PANEL_DEMO_PASSWORD! });
  if (error) throw new Error(`login de recepción: ${error.message}`);
  console.log(`recepción (staff)               turnos/pacientes/derivaciones/mensajes: ${await contar(recepcion)}`);

  const borrar = await recepcion.from("turnos").delete().eq("id", "tur-001").select();
  console.log(`recepción intenta borrar turno  filas borradas: ${borrar.data?.length ?? 0} (no hay política de borrado)`);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
