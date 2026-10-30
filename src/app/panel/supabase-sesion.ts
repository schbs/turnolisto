// Cliente de Supabase con la sesión del usuario (cookies). Usa la clave pública: todo lo que lee pasa por RLS,
// así que solo el personal (tabla staff) ve datos.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseSesion() {
  const almacen = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // En un Server Component no se pueden escribir cookies; las acciones (login, salir) sí.
        }
      },
    },
  });
}
