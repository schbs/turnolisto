// Datos de contacto de la clínica ficticia, en un solo lugar. El WhatsApp es el número de prueba de Meta de la demo.
import clinica from "../../data/clinica.json";

export const sitio = {
  nombre: clinica.nombre,
  marca: "Confluencia",
  descripcion: "Clínica dental en Neuquén: pedí, cambiá o cancelá tu turno por WhatsApp, a cualquier hora.",
  whatsapp: "15551385168",
  whatsappVisible: "+1 555 138-5168 (número de prueba de la demo)",
  direccion: clinica.direccion,
  horarios: clinica.horarios,
  telefonoRecepcion: clinica.telefono_recepcion,
  telefonoGuardia: clinica.telefono_guardia,
  url: "http://localhost:3201",
};

export const enlaceWhatsapp = (texto = "Hola, quiero sacar un turno") => `https://wa.me/${sitio.whatsapp}?text=${encodeURIComponent(texto)}`;
