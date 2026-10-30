// Normaliza celulares argentinos al formato que usa WhatsApp: +54 9 <área sin 0> <número sin 15>.

/**
 * Acepta las formas habituales ("0299 15 555-0101", "+54 9 299 555 0101", "11 5555-0102", el wa_id "549…")
 * y devuelve "+549XXXXXXXXXX", o null si no parece un celular argentino.
 */
export function normalizarTelefonoAR(entrada: string): string | null {
  let d = entrada.replace(/\D/g, "");

  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
  } else if (d.startsWith("0")) {
    d = d.slice(1);
  }

  // Con el "15" local quedan 12 dígitos. El área tiene 2, 3 o 4 dígitos: se saca el primer "15" que cae justo después.
  if (d.length === 12) {
    const corte = [2, 3, 4].find((largo) => d.slice(largo, largo + 2) === "15");
    if (corte === undefined) return null;
    d = d.slice(0, corte) + d.slice(corte + 2);
  }

  // Número nacional: 10 dígitos y las áreas argentinas empiezan con 1, 2 o 3.
  if (!/^[123]\d{9}$/.test(d)) return null;
  return `+549${d}`;
}

/** wa_id de la API de WhatsApp: el mismo número sin el "+". */
export function aWaId(telefonoE164: string): string {
  return telefonoE164.replace(/^\+/, "");
}
