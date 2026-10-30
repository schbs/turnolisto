import type { Metadata } from "next";
import { UI } from "@/i18n/ui";
import { VistaIngresar } from "@/panel/vista-ingresar";

export const metadata: Metadata = { title: UI.en.ingresar.tituloPagina, description: UI.en.ingresar.descripcionPagina };

export default function SignIn() {
  return <VistaIngresar idioma="en" />;
}
