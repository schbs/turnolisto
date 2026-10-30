import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Lexend } from "next/font/google";
import { sitio } from "@/config/sitio";
import "./globals.css";

const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"], weight: ["500", "600"], display: "swap" });
const atkinson = Atkinson_Hyperlegible({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400", "700"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(sitio.url),
  title: { default: "Clínica Dental Confluencia · Turnos por WhatsApp", template: "%s · Clínica Dental Confluencia" },
  description: `${sitio.descripcion} Proyecto de demostración con datos ficticios.`,
};

// Solo el color de la barra del navegador: el zoom nunca se bloquea.
export const viewport: Viewport = { themeColor: "#fbf6ef" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={`${lexend.variable} ${atkinson.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-crema font-sans text-tinta">{children}</body>
    </html>
  );
}
