// Firma de los webhooks de Meta: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(cuerpo crudo, clave secreta de la app).
import { createHmac, timingSafeEqual } from "node:crypto";

export function firmar(cuerpoCrudo: string, secreto: string): string {
  return `sha256=${createHmac("sha256", secreto).update(cuerpoCrudo, "utf8").digest("hex")}`;
}

/** Compara en tiempo constante. Un encabezado ausente o con otro formato es inválido. */
export function firmaValida(cuerpoCrudo: string, encabezado: string | null, secreto: string): boolean {
  if (!encabezado?.startsWith("sha256=") || !secreto) return false;
  const esperada = Buffer.from(firmar(cuerpoCrudo, secreto));
  const recibida = Buffer.from(encabezado);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}
