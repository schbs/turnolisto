"use server";
// Acciones del panel de recepción. Corren con la sesión del usuario: RLS decide qué puede cambiar.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ruta, type Idioma } from "@/i18n/idioma";
import { UI } from "@/i18n/ui";
import { supabaseSesion } from "./supabase-sesion";

export interface EstadoIngreso {
  error?: string;
}

const idiomaDe = (datos: FormData): Idioma => (datos.get("idioma") === "en" ? "en" : "es");

/** Las dos versiones del panel muestran los mismos datos: se revalidan juntas. */
const revalidarPanel = () => {
  revalidatePath("/panel");
  revalidatePath("/en/panel");
};

export async function ingresar(_previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const idioma = idiomaDe(datos);
  const errores = UI[idioma].ingresar.errores;
  const credenciales = z.object({ email: z.email(errores.email), password: z.string().min(1, errores.contrasena) });
  const v = credenciales.safeParse({ email: datos.get("email"), password: datos.get("password") });
  if (!v.success) return { error: v.error.issues[0].message };
  const supabase = await supabaseSesion();
  const { error } = await supabase.auth.signInWithPassword(v.data);
  if (error) return { error: errores.credenciales };
  redirect(ruta(idioma, "/panel"));
}

export async function salir(datos: FormData) {
  const supabase = await supabaseSesion();
  await supabase.auth.signOut();
  redirect(ruta(idiomaDe(datos), "/panel/ingresar"));
}

/** Recepción confirma un turno (por ejemplo, lo confirmó por teléfono). */
export async function confirmarTurno(datos: FormData) {
  const id = z.string().min(1).parse(datos.get("turno"));
  const supabase = await supabaseSesion();
  const { error } = await supabase.from("turnos").update({ estado: "confirmado" }).eq("id", id).eq("estado", "reservado");
  if (error) throw new Error(`No se pudo confirmar el turno: ${error.message}`);
  revalidarPanel();
}

/** Cierra una derivación y le devuelve la conversación al asistente. */
export async function resolverDerivacion(datos: FormData) {
  const id = z.coerce.number().int().parse(datos.get("derivacion"));
  const telefono = z.string().min(1).parse(datos.get("telefono"));
  const supabase = await supabaseSesion();
  const { error } = await supabase.from("handoffs").update({ estado: "resuelto", resuelto_en: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`No se pudo resolver la derivación: ${error.message}`);
  // Si no quedan otras pendientes de ese número, el bot vuelve a contestar.
  const { count } = await supabase.from("handoffs").select("id", { count: "exact", head: true }).eq("telefono", telefono).neq("estado", "resuelto");
  if (!count) await supabase.from("conversaciones").update({ pausado: false, fallos: 0 }).eq("telefono", telefono);
  revalidarPanel();
}
