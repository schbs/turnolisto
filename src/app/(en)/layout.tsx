import type { Metadata } from "next";
import { Documento } from "@/components/documento";
import { sitio } from "@/config/sitio";
import { UI } from "@/i18n/ui";

export { viewport } from "@/components/documento";

export const metadata: Metadata = {
  metadataBase: new URL(sitio.url),
  title: { default: UI.en.landing.tituloPagina, template: "%s · Confluencia Dental Clinic" },
  description: `${UI.en.clinica.descripcion} Demo project with fictional data.`,
};

export default function LayoutIngles({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Documento idioma="en">{children}</Documento>;
}
