"use client";
import { useActionState } from "react";
import { IconoAlerta } from "@/components/iconos";
import { ingresar, type EstadoIngreso } from "../acciones";

const campo = "min-h-12 rounded-xl border border-borde bg-blanco px-4 text-base";

export function FormularioIngreso() {
  const [estado, accion, pendiente] = useActionState<EstadoIngreso, FormData>(ingresar, {});
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 font-bold">
        Email
        <input name="email" type="email" autoComplete="username" required className={campo} aria-describedby={estado.error ? "error-ingreso" : undefined} />
      </label>
      <label className="flex flex-col gap-1 font-bold">
        Contraseña
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
        {pendiente ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
