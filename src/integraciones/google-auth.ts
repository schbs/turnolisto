// Token OAuth de una cuenta de servicio de Google (JWT firmado con su clave privada), con caché hasta que vence.
import { createSign } from "node:crypto";

export interface CuentaServicio {
  email: string;
  /** Clave privada PEM; acepta "\n" escritos como texto (así queda en .env.local). */
  clavePrivada: string;
}

export function crearProveedorDeToken(cuenta: CuentaServicio, alcance: string) {
  let cache: { valor: string; vence: number } | null = null;

  return async function token(): Promise<string> {
    if (cache && cache.vence > Date.now() + 60_000) return cache.valor;
    const b64 = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const ahora = Math.floor(Date.now() / 1000);
    const cuerpo = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
      iss: cuenta.email,
      scope: alcance,
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600,
    })}`;
    const firma = createSign("RSA-SHA256").update(cuerpo).sign(cuenta.clavePrivada.replace(/\\n/g, "\n"), "base64url");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cuerpo}.${firma}` }),
      signal: AbortSignal.timeout(10_000),
    });
    const datos = (await r.json()) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!r.ok || !datos.access_token) throw new Error(`Google no dio el token: ${datos.error_description ?? r.status}`);
    cache = { valor: datos.access_token, vence: Date.now() + (datos.expires_in ?? 3600) * 1000 };
    return cache.valor;
  };
}
