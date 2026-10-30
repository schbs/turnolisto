import type { Metadata } from "next";
import { UI } from "@/i18n/ui";
import { VistaPanel } from "@/panel/vista-panel";

export const metadata: Metadata = { title: UI.en.panel.tituloPagina, description: UI.en.panel.descripcionPagina };

export default async function Panel({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  return <VistaPanel idioma="en" semana={(await searchParams).semana} />;
}
