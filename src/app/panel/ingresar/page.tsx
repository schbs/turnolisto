import type { Metadata } from "next";
import Link from "next/link";
import { IconoDiente } from "@/components/iconos";
import { FormularioIngreso } from "./formulario";

export const metadata: Metadata = {
  title: "Ingresar al panel de recepción",
  description: "Acceso del personal de la Clínica Dental Confluencia (demo con datos ficticios).",
};

export default function Ingresar() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 font-titulo font-semibold text-menta-800">
          <IconoDiente className="text-coral-700" width={22} height={22} />
          Confluencia · Recepción
        </span>
        <h1 className="font-titulo text-3xl font-semibold">Ingresar al panel</h1>
        <p className="text-tinta-suave">Solo para el personal de la clínica.</p>
      </div>
      <FormularioIngreso />
      <p className="text-sm text-tinta-suave">
        Proyecto de demostración — marca ficticia.{" "}
        <Link href="/" className="font-bold text-menta-700 underline underline-offset-4">
          Volver al sitio
        </Link>
      </p>
    </main>
  );
}
