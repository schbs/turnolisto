// Pasa el JSON de la cuenta de servicio de Google a .env.local (GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY)
// sin mostrar nada en pantalla. Uso: node scripts/cargar-cuenta-servicio.mjs "C:\ruta\al\archivo.json"
// Después de correrlo, borrá el JSON descargado.
import fs from "node:fs";

const ruta = process.argv[2];
if (!ruta) {
  console.error('Falta la ruta del JSON. Ejemplo: node scripts/cargar-cuenta-servicio.mjs "C:\\ruta\\al\\archivo.json"');
  process.exit(1);
}

const cuenta = JSON.parse(fs.readFileSync(ruta, "utf8"));
if (cuenta.type !== "service_account" || !cuenta.client_email || !cuenta.private_key) {
  console.error("Ese archivo no parece la clave JSON de una cuenta de servicio.");
  process.exit(1);
}

const valores = {
  GOOGLE_SERVICE_ACCOUNT_EMAIL: cuenta.client_email,
  GOOGLE_PRIVATE_KEY: `"${cuenta.private_key.replace(/\n/g, "\\n")}"`,
};

let env = fs.readFileSync(".env.local", "utf8");
for (const [nombre, valor] of Object.entries(valores)) {
  const linea = new RegExp(`^${nombre}=.*$`, "m");
  env = linea.test(env) ? env.replace(linea, () => `${nombre}=${valor}`) : `${env.trimEnd()}\n${nombre}=${valor}\n`;
}
fs.writeFileSync(".env.local", env);
console.log("Listo: GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY cargadas en .env.local. Ahora borrá el JSON descargado.");
