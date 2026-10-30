"use server";
// Acciones del panel de recepción. Corren con la sesión del usuario: RLS decide qué puede cambiar.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseSesion } from "./supabase-sesion";

export interface EstadoIngreso {
  error?: string;
}

const credenciales = z.object({ email: z.email("Revisá el email."), password: z.string().min(1, "Falta la contraseña.") });

export async function ingresar(_previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const v = credenciales.safeParse({ email: datos.get("email"), password: datos.get("password") });
  if (!v.success) return { error: v.error.issues[0].message };
  const supabase = await supabaseSesion();
  const { error } = await supabase.auth.signInWithPassword(v.data);
  if (error) return { error: "El email o la contraseña no coinciden." };
  redirect("/panel");
}

export async function salir() {
  const supabase = await supabaseSesion();
  await supabase.auth.signOut();
  redirect("/panel/ingresar");
}

/** Recepción confirma un turno (por ejemplo, lo confirmó por teléfono). */
export async function confirmarTurno(datos: FormData) {
  const id = z.string().min(1).parse(datos.get("turno"));
  const supabase = await supabaseSesion();
  const { error } = await supabase.from("turnos").update({ estado: "confirmado" }).eq("id", id).eq("estado", "reservado");
  if (error) throw new Error(`No se pudo confirmar el turno: ${error.message}`);
  revalidatePath("/panel");
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
  revalidatePath("/panel");
}
