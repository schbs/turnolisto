"use client";
import { useActionState } from "react";
import { IconoAlerta } from "@/components/iconos";
import type { Idioma } from "@/i18n/idioma";
import { UI } from "@/i18n/ui";
import { ingresar, type EstadoIngreso } from "./acciones";

const campo = "min-h-12 rounded-xl border border-borde bg-blanco px-4 text-base";

export function FormularioIngreso({ idioma }: { idioma: Idioma }) {
  const t = UI[idioma].ingresar;
  const [estado, accion, pendiente] = useActionState<EstadoIngreso, FormData>(ingresar, {});
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="idioma" value={idioma} />
      <label className="flex flex-col gap-1 font-bold">
        {t.email}
        <input name="email" type="email" autoComplete="username" required className={campo} aria-describedby={estado.error ? "error-ingreso" : undefined} />
      </label>
      <label className="flex flex-col gap-1 font-bold">
        {t.contrasena}
        <input name="password" type="password" autoComplete="current-password" required className={campo} />
      </label>
      <p id="error-ingreso" role="alert" aria-live="assertive" className="min-h-6">
        {estado.error && (
          <span className="flex items-center gap-2 text-ausente">
            <IconoAlerta />
            {estado.error}
          </span>
        )}
      </p>
      <button type="submit" disabled={pendiente} className="min-h-12 rounded-full bg-menta-700 px-6 font-bold text-blanco hover:bg-menta-800 disabled:opacity-70">
        {pendiente ? t.ingresando : t.boton}
      </button>
    </form>
  );
}
