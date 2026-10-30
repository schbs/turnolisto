import type { Metadata } from "next";
import { UI } from "@/i18n/ui";
import { VistaPanel } from "@/panel/vista-panel";

export const metadata: Metadata = { title: UI.es.panel.tituloPagina, description: UI.es.panel.descripcionPagina };

export default async function Panel({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  return <VistaPanel idioma="es" semana={(await searchParams).semana} />;
}
