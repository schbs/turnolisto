// Documento HTML compartido por los dos layouts raíz (español e inglés): fuentes, colores y lang.
import type { Viewport } from "next";
import { Atkinson_Hyperlegible, Lexend } from "next/font/google";
import type { Idioma } from "@/i18n/idioma";
import "../app/globals.css";

const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"], weight: ["500", "600"], display: "swap" });
const atkinson = Atkinson_Hyperlegible({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400", "700"], display: "swap" });

// Solo el color de la barra del navegador: el zoom nunca se bloquea.
export const viewport: Viewport = { themeColor: "#fbf6ef" };

export function Documento({ idioma, children }: Readonly<{ idioma: Idioma; children: React.ReactNode }>) {
  return (
    <html lang={idioma === "en" ? "en" : "es-AR"} className={`${lexend.variable} ${atkinson.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-crema font-sans text-tinta">{children}</body>
    </html>
  );
}
