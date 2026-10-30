// Bucle del agente: el modelo elige herramientas hasta llamar a "responder", que trae el mensaje final validado.
import type { EstadoConversacion } from "@/datos/repositorio";
import { declaraciones, ejecutarHerramienta, validarArgs, type ContextoHerramientas, type Respuesta } from "./herramientas";
import type { Contenido, Modelo, Parte, Uso } from "./modelo";

const MAX_LLAMADAS = 6;
const MAX_ORACIONES = 3;

export interface ResultadoAgente {
  respuesta: Respuesta;
  llamadasModelo: number;
  uso: Uso;
}

// Puntos que no cierran oración: abreviaturas ("Dra.", "Av.") y números ("150.000", "5.30").
const PUNTO_PROTEGIDO = "․";
// "hs." no va: casi siempre cierra la oración ("…a las 15 hs.").
const ABREVIATURA = /\b(Dra|Dr|Sra|Sr|Lic|Od|Av|aprox|nro|tel)\./gi;

/** Divide un texto en oraciones sin cortar en abreviaturas ni en números con punto. */
export function oraciones(texto: string): string[] {
  const protegido = texto.trim().replace(ABREVIATURA, `$1${PUNTO_PROTEGIDO}`).replace(/(\d)\.(\d)/g, `$1${PUNTO_PROTEGIDO}$2`);
  return (protegido.match(/[^.!?…]+(?:[.!?…]+|$)/g) ?? [])
    .map((o) => o.trim().replaceAll(PUNTO_PROTEGIDO, "."))
    .filter(Boolean);
}

/** Deja como mucho 3 oraciones (red de seguridad: el prompt ya lo pide). */
export function recortarOraciones(texto: string, max = MAX_ORACIONES): string {
  const partes = oraciones(texto);
  return partes.length ? partes.slice(0, max).join(" ") : texto.trim();
}

export async function ejecutarAgente(opciones: {
  modelo: Modelo;
  sistema: string;
  estado: EstadoConversacion;
  mensaje: string;
  ctx: ContextoHerramientas;
}): Promise<ResultadoAgente> {
  const { modelo, ctx } = opciones;
  const herramientas = declaraciones(ctx.deps.repo);
  const contenidos: Contenido[] = [
    ...opciones.estado.historial.map((h): Contenido => ({ role: h.rol === "usuario" ? "user" : "model", parts: [{ text: h.texto }] })),
    { role: "user", parts: [{ text: opciones.mensaje }] },
  ];
  const uso: Uso = { entrada: 0, salida: 0, pensamiento: 0 };

  for (let llamada = 1; llamada <= MAX_LLAMADAS; llamada++) {
    const r = await modelo.generar({ sistema: opciones.sistema, contenidos, herramientas });
    uso.entrada += r.uso?.entrada ?? 0;
    uso.salida += r.uso?.salida ?? 0;
    uso.pensamiento += r.uso?.pensamiento ?? 0;
    contenidos.push(r.contenido);

    const llamadas = r.contenido.parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    if (!llamadas.length) {
      // Con mode ANY no debería pasar; si viene texto suelto, se usa como respuesta.
      const texto = r.contenido.parts.map((p) => p.text ?? "").join(" ").trim();
      if (texto) return { respuesta: { texto: recortarOraciones(texto), entendio: true, tema: "otro" }, llamadasModelo: llamada, uso };
      continue;
    }

    const respuestas: Parte[] = [];
    for (const fc of llamadas) {
      if (fc.name === "responder") {
        const v = validarArgs(ctx.deps.repo, "responder", fc.args);
        if (v.ok) {
          const args = v.args as Respuesta;
          return { respuesta: { ...args, texto: recortarOraciones(args.texto) }, llamadasModelo: llamada, uso };
        }
        respuestas.push({ functionResponse: { name: fc.name, id: fc.id, response: { ok: false, error: `Argumentos inválidos: ${v.error}` } } });
        continue;
      }
      const resultado = await ejecutarHerramienta(fc.name, fc.args, ctx);
      respuestas.push({ functionResponse: { name: fc.name, id: fc.id, response: resultado } });
    }
    contenidos.push({ role: "user", parts: respuestas });
  }

  return {
    respuesta: { texto: "Perdón, se me complicó entenderte. ¿Me lo contás de otra forma?", entendio: false, tema: "otro" },
    llamadasModelo: MAX_LLAMADAS,
    uso,
  };
}
