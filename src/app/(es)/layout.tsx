import type { Metadata } from "next";
import { Documento } from "@/components/documento";
import { sitio } from "@/config/sitio";
import { UI } from "@/i18n/ui";

export { viewport } from "@/components/documento";

export const metadata: Metadata = {
  metadataBase: new URL(sitio.url),
  title: { default: UI.es.landing.tituloPagina, template: "%s · Clínica Dental Confluencia" },
  description: `${UI.es.clinica.descripcion} Proyecto de demostración con datos ficticios.`,
};

export default function LayoutEspanol({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Documento idioma="es">{children}</Documento>;
}
