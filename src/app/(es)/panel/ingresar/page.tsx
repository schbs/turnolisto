import type { Metadata } from "next";
import { UI } from "@/i18n/ui";
import { VistaIngresar } from "@/panel/vista-ingresar";

export const metadata: Metadata = { title: UI.es.ingresar.tituloPagina, description: UI.es.ingresar.descripcionPagina };

export default function Ingresar() {
  return <VistaIngresar idioma="es" />;
}
