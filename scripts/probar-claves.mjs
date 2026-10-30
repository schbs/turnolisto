// Prueba que las claves respondan, con pedidos gratis que no generan ni escriben nada. No muestra ninguna clave.
try {
  process.loadEnvFile(".env.local");
} catch {
  console.log("(no hay .env.local todavía)");
}

const pruebas = {
  GEMINI_API_KEY: async (clave) => {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", { headers: { "x-goog-api-key": clave } });
    const datos = r.ok ? await r.json() : null;
    const flash = datos?.models?.filter((m) => m.name.includes("flash")).map((m) => m.name.replace("models/", "")) ?? [];
    return { estado: r.status, detalle: datos ? `${datos.models.length} modelos (flash: ${flash.slice(0, 4).join(", ")})` : "" };
  },
  GROQ_API_KEY: async (clave) => {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${clave}` } });
    const datos = r.ok ? await r.json() : null;
    const whisper = datos?.data?.filter((m) => m.id.includes("whisper")).map((m) => m.id) ?? [];
    return { estado: r.status, detalle: datos ? `${datos.data.length} modelos (whisper: ${whisper.join(", ")})` : "" };
  },
  // Clave publicable: lee la configuración pública de Auth.
  NEXT_PUBLIC_SUPABASE_ANON_KEY: async (clave) => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: clave } });
    return { estado: r.status, detalle: `(${clave.startsWith("sb_publishable_") ? "publishable" : "otro formato"})` };
  },
  // Clave secreta: la descripción de la API REST solo se entrega con una clave secreta.
  SUPABASE_SERVICE_ROLE_KEY: async (clave) => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, { headers: { apikey: clave } });
    const datos = r.ok ? await r.json() : null;
    const tablas = datos ? Object.keys(datos.paths ?? {}).filter((p) => p !== "/").length : 0;
    return { estado: r.status, detalle: `(${clave.startsWith("sb_secret_") ? "secret" : "otro formato"}; tablas: ${tablas})` };
  },
  // WhatsApp: lee los datos del número de prueba (no manda mensajes).
  WHATSAPP_TOKEN: async (token) => {
    const r = await fetch(
      `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const datos = await r.json();
    return { estado: r.status, detalle: r.ok ? `número ${datos.display_phone_number} ("${datos.verified_name}")` : datos.error?.message ?? "" };
  },
  // Clave secreta de la app: Meta rechaza un appsecret_proof (HMAC del token) firmado con una clave equivocada.
  WHATSAPP_APP_SECRET: async (secreto) => {
    const { createHmac } = await import("node:crypto");
    const token = process.env.WHATSAPP_TOKEN;
    const prueba = createHmac("sha256", secreto).update(token).digest("hex");
    const r = await fetch(`https://graph.facebook.com/v25.0/me?fields=id&appsecret_proof=${prueba}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const datos = await r.json();
    return { estado: r.status, detalle: r.ok ? "appsecret_proof aceptado" : datos.error?.message ?? "" };
  },
  // Cuenta de servicio: pide un token y lee los datos del calendario compartido (no crea eventos).
  GOOGLE_CALENDAR_ID: async (calendarioId) => {
    const token = await tokenDeGoogle("https://www.googleapis.com/auth/calendar");
    if (!token.ok) return { estado: token.estado, detalle: `al pedir el token: ${token.error}` };
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarioId)}`, {
      headers: { Authorization: `Bearer ${token.valor}` },
    });
    const datos = await r.json();
    return { estado: r.status, detalle: r.ok ? `calendario "${datos.summary}", zona ${datos.timeZone}` : datos.error?.message ?? "" };
  },
};

/** Token OAuth de la cuenta de servicio (JWT firmado con su clave privada). */
async function tokenDeGoogle(alcance) {
  const { createSign } = await import("node:crypto");
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: alcance,
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 600,
  })}`;
  const firma = createSign("RSA-SHA256").update(cuerpo).sign(process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"), "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cuerpo}.${firma}` }),
  });
  const datos = await r.json();
  return r.ok ? { ok: true, valor: datos.access_token } : { ok: false, estado: r.status, error: datos.error_description ?? datos.error };
}

for (const [nombre, probar] of Object.entries(pruebas)) {
  const clave = process.env[nombre]?.trim();
  if (!clave) {
    console.log(`FALTA  ${nombre}`);
    continue;
  }
  try {
    const { estado, detalle } = await probar(clave);
    console.log(`${estado === 200 ? "OK   " : "ERROR"}  ${nombre} → HTTP ${estado} ${detalle}`);
  } catch (e) {
    console.log(`ERROR  ${nombre} → ${e.message}`);
  }
}
