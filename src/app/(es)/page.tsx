import type { Metadata } from "next";
import { Landing } from "@/components/landing";

export const metadata: Metadata = { alternates: { canonical: "/", languages: { en: "/en" } } };

export default function Inicio() {
  return <Landing idioma="es" />;
}
