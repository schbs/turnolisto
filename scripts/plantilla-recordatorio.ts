// Crea (o consulta) la plantilla "recordatorio_turno" en la cuenta de WhatsApp Business de la demo.
// Uso: npm run plantilla            → muestra el estado (APPROVED, PENDING, REJECTED) o la crea si no existe
// Necesita WHATSAPP_TOKEN y WHATSAPP_WABA_ID en .env.local.
const NOMBRE = "recordatorio_turno";
const IDIOMA = "es_AR";

const definicion = {
  name: NOMBRE,
  language: IDIOMA,
  category: "UTILITY",
  components: [
    {
      type: "BODY",
      text: "Hola {{1}}, te recordamos tu turno de {{2}} el {{3}} con {{4}} en Clínica Dental Confluencia. ¿Confirmás que venís?",
      example: { body_text: [["Tomás", "limpieza dental", "jueves 5/11 a las 15:00", "Dra. Sofía Ibáñez"]] },
    },
    { type: "FOOTER", text: "Demo con datos ficticios" },
    {
      type: "BUTTONS",
      buttons: [
        { type: "QUICK_REPLY", text: "Confirmo" },
        { type: "QUICK_REPLY", text: "Reprogramar" },
      ],
    },
  ],
};

async function main() {
  process.loadEnvFile(".env.local");
  const token = process.env.WHATSAPP_TOKEN;
  const waba = process.env.WHATSAPP_WABA_ID;
  if (!token || !waba) throw new Error("Faltan WHATSAPP_TOKEN o WHATSAPP_WABA_ID en .env.local");
  const base = `https://graph.facebook.com/v25.0/${waba}/message_templates`;
  const auth = { Authorization: `Bearer ${token}` };

  const existente = (await (await fetch(`${base}?name=${NOMBRE}&fields=name,status,language,category`, { headers: auth })).json()) as {
    data?: { name: string; status: string; language: string; category: string }[];
    error?: { message: string };
  };
  if (existente.error) throw new Error(existente.error.message);
  const ya = existente.data?.find((p) => p.language === IDIOMA);
  if (ya) {
    console.log(`La plantilla ${ya.name} (${ya.language}, ${ya.category}) ya existe. Estado: ${ya.status}`);
    return;
  }
  const r = await fetch(base, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(definicion) });
  const datos = (await r.json()) as { id?: string; status?: string; category?: string; error?: { message: string; error_user_msg?: string } };
  if (!r.ok) throw new Error(datos.error?.error_user_msg ?? datos.error?.message ?? `HTTP ${r.status}`);
  console.log(`Plantilla ${NOMBRE} creada (id ${datos.id}). Estado: ${datos.status}, categoría: ${datos.category}`);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
