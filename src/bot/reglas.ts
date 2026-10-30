// Reglas fijas que van ANTES del modelo: lo urgente y el pedido de hablar con una persona no dependen de la IA.

const quitarTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const URGENCIA = [
  /dolor (muy |re |tan )?(fuerte|insoportable|terrible|tremendo)/,
  /me duele (mucho|un monton|demasiado|horrible)/,
  /no (aguanto|soporto) (el|mas|la)/,
  /sangr(a|o|ando|ado|e)/,
  /hinch(o|ada|ado|azon)/,
  /\bgolpe\b|me (rompi|parti|cai)/,
  /\burgen(te|cia)\b/,
  /\bfiebre\b/,
  // Inglés
  /\b(severe|unbearable|excruciating|terrible|awful) (pain|toothache|ache)\b/,
  /\bbleed(ing|s)?\b/,
  /\bswollen\b|\bswelling\b/,
  /\bemergency\b|\burgent\b/,
  /\bfever\b/,
  /\b(broke|cracked|chipped|knocked out) (a|my) tooth\b/,
];

const HUMANO = [
  /(hablar|comunicarme|charlar|atenderme) con (una persona|alguien|un humano|recepcion|la secretaria|un operador)/,
  /\b(humano|operador|persona real)\b/,
  /atencion (humana|personal)/,
  /pasame con/,
  // Inglés
  /\b(talk|speak|chat) (to|with) (a person|someone|somebody|a human|a real person|the front desk|reception|an agent|staff)\b/,
  /\bhuman\b|\breal person\b/,
];

export function esUrgencia(texto: string): boolean {
  const t = quitarTildes(texto);
  return URGENCIA.some((r) => r.test(t));
}

export function pideHumano(texto: string): boolean {
  const t = quitarTildes(texto);
  return HUMANO.some((r) => r.test(t));
}
