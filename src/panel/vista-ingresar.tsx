import Link from "next/link";
import { IconoDiente } from "@/components/iconos";
import { ruta, type Idioma } from "@/i18n/idioma";
import { UI } from "@/i18n/ui";
import { FormularioIngreso } from "./formulario-ingreso";

export function VistaIngresar({ idioma }: { idioma: Idioma }) {
  const t = UI[idioma].ingresar;
  const otro = UI[idioma].otroIdioma;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-titulo font-semibold text-menta-800">
            <IconoDiente className="text-coral-700" width={22} height={22} />
            {t.marca}
          </span>
          <Link
            href={ruta(otro.lang as Idioma, "/panel/ingresar")}
            hrefLang={otro.lang}
            lang={otro.lang}
            className="inline-flex min-h-11 items-center text-sm font-bold text-menta-700 underline underline-offset-4"
          >
            {otro.etiqueta}
          </Link>
        </div>
        <h1 className="font-titulo text-3xl font-semibold">{t.titulo}</h1>
        <p className="text-tinta-suave">{t.bajada}</p>
      </div>
      <FormularioIngreso idioma={idioma} />
      <p className="text-sm text-tinta-suave">
        {t.demo}{" "}
        <Link href={ruta(idioma, "/")} className="font-bold text-menta-700 underline underline-offset-4">
          {t.volver}
        </Link>
      </p>
    </main>
  );
}
