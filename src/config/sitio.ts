// Datos del sitio de la clínica ficticia. El WhatsApp es el número de prueba de Meta de la demo.
// Los textos visibles (dirección, horarios, guardia) están en los dos idiomas en src/i18n/ui.ts.
import clinica from "../../data/clinica.json";

export const sitio = {
  nombre: clinica.nombre,
  marca: "Confluencia",
  whatsapp: "15551385168",
  url: "http://localhost:3201",
};

export const enlaceWhatsapp = (texto = "Hola, quiero sacar un turno") => `https://wa.me/${sitio.whatsapp}?text=${encodeURIComponent(texto)}`;
