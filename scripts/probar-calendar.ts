// Prueba el adaptador real de Google Calendar contra el calendario de demo: crea un evento, lo mueve y lo borra.
// Uso: npm run probar-calendar
import { crearCalendarioGoogle } from "../src/calendario/calendario";
import { configAgenda } from "../src/config/clinica";

async function main() {
  process.loadEnvFile(".env.local");
  const calendario = crearCalendarioGoogle({
    cuenta: { email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!, clavePrivada: process.env.GOOGLE_PRIVATE_KEY! },
    calendarioId: process.env.GOOGLE_CALENDAR_ID!,
    zona: configAgenda.zona,
  });
  const manana = new Date(Date.now() + 24 * 3600_000);
  manana.setUTCHours(13, 0, 0, 0); // 10:00 en Argentina
  const mas = (minutos: number) => new Date(manana.getTime() + minutos * 60_000).toISOString();

  let t = Date.now();
  const id = await calendario.crear({ titulo: "Prueba TurnoListo (se borra sola)", descripcion: "Evento de prueba del adaptador.", inicio: mas(0), fin: mas(30) });
  console.log(`crear   OK (${Date.now() - t} ms)`);
  t = Date.now();
  await calendario.mover(id, mas(60), mas(90));
  console.log(`mover   OK (${Date.now() - t} ms)`);
  t = Date.now();
  await calendario.borrar(id);
  console.log(`borrar  OK (${Date.now() - t} ms)`);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
