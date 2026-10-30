// Idiomas de la demo: español rioplatense por defecto e inglés (para pacientes que escriben en inglés y para Upwork).

export type Idioma = "es" | "en";

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const PALABRAS_EN = new Set(
  "hi hello hey please thanks thank you your i i'd i'm im my want would like book booking appointment can could need the is are it for with what when where how works work tomorrow today afternoon morning evening cleaning tooth toothache teeth pain hurts cancel reschedule yes sure great fine one that this there time times available do does don't have has".split(" "),
);
const PALABRAS_ES = new Set(
  "hola quiero queria quisiera turno turnos para por el la los las del que mi una un es gracias si dale bueno manana tarde limpieza sacar cancelar cambiar puedo puede tengo tenes muela dolor hora horario horarios buenas buen dia dias esta estoy necesito consulta cuanto sale obra social".split(" "),
);

/**
 * Idioma de un mensaje por palabras frecuentes. null si no alcanza para decidir ("15:00", "ok", un nombre):
 * en ese caso se sigue con el idioma que ya tenía la conversación.
 */
export function detectarIdioma(texto: string): Idioma | null {
  const palabras = sinTildes(texto).match(/[a-z']+/g) ?? [];
  let en = 0;
  let es = /[¿¡]/.test(texto) ? 2 : 0;
  for (const p of palabras) {
    if (PALABRAS_EN.has(p)) en++;
    if (PALABRAS_ES.has(p)) es++;
  }
  if (en === es) return null;
  return en > es ? "en" : "es";
}

/** Ruta de una página en ese idioma: el español va sin prefijo y el inglés bajo /en. */
export const ruta = (idioma: Idioma, camino: string) => (idioma === "en" ? `/en${camino === "/" ? "" : camino}` : camino);

export const localeDe = (idioma: Idioma) => (idioma === "en" ? "en-US" : "es-AR");
