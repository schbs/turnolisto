import type { Metadata } from "next";
import { Landing } from "@/components/landing";

export const metadata: Metadata = { alternates: { canonical: "/en", languages: { "es-AR": "/" } } };

export default function Home() {
  return <Landing idioma="en" />;
}
