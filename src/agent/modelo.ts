// Cliente mínimo de Gemini (REST generateContent) con function calling obligatorio, timeout y reintentos.
// También un modelo "grabado" que repite respuestas guardadas: así los tests de conversación son deterministas
// y no gastan cuota, pero lo que repiten salió de Gemini de verdad.

export interface Parte {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
  thoughtSignature?: string;
  [otro: string]: unknown;
}

export interface Contenido {
  role: "user" | "model";
  parts: Parte[];
}

export interface DeclaracionHerramienta {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
}

export interface PedidoModelo {
  sistema: string;
  contenidos: Contenido[];
  herramientas: DeclaracionHerramienta[];
}

export interface Uso {
  entrada: number;
  salida: number;
  pensamiento: number;
}

export interface RespuestaModelo {
  contenido: Contenido;
  uso?: Uso;
}

export interface Modelo {
  nombre: string;
  generar(pedido: PedidoModelo): Promise<RespuestaModelo>;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class CupoAgotado extends Error {}

/** "Please retry in 12h9m7.8s" → segundos. 0 si el mensaje no lo dice. */
export function segundosDeEspera(mensaje: string): number {
  const m = mensaje.match(/retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3]);
}

// Flash-Lite: tool calling correcto, ~1 s por llamada y su propio cupo gratis
// (gemini-3.5-flash tiene solo 20 pedidos por día en el plan gratis: medido el 30/10/2026).
export const MODELO_POR_DEFECTO = "gemini-3.5-flash-lite";

export function crearModeloGemini(opciones: {
  apiKey: string;
  modelo?: string;
  timeoutMs?: number;
  reintentos?: number;
  /** Para medir: se llama cada vez que una llamada falla y se va a reintentar. */
  alReintentar?: (motivo: string) => void;
}): Modelo {
  const nombre = opciones.modelo ?? MODELO_POR_DEFECTO;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${nombre}:generateContent`;

  return {
    nombre,
    async generar(pedido) {
      const cuerpo = JSON.stringify({
        systemInstruction: { parts: [{ text: pedido.sistema }] },
        contents: pedido.contenidos,
        tools: [{ functionDeclarations: pedido.herramientas }],
        // ANY: el modelo siempre llama a una herramienta; la respuesta final también es una herramienta ("responder").
        toolConfig: { functionCallingConfig: { mode: "ANY" } },
        generationConfig: { temperature: 0.2, thinkingConfig: { thinkingLevel: "low" } },
      });

      let ultimoError: unknown;
      for (let intento = 0; intento <= (opciones.reintentos ?? 3); intento++) {
        if (intento > 0) await esperar(1000 * 2 ** (intento - 1));
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "x-goog-api-key": opciones.apiKey, "Content-Type": "application/json" },
            body: cuerpo,
            signal: AbortSignal.timeout(opciones.timeoutMs ?? 25_000),
          });
          if (r.status === 429) {
            // El plan gratis tiene cupo por minuto y por día. Si Gemini pide esperar más de un minuto, es el diario:
            // reintentar no sirve, se avisa enseguida.
            const error = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
            const espera = segundosDeEspera(error?.error?.message ?? "");
            if (espera > 60) throw new CupoAgotado(`Se terminó el cupo de Gemini (${nombre}); vuelve en ${Math.round(espera / 60)} min.`);
            ultimoError = new Error("Gemini respondió 429");
            opciones.alReintentar?.(`429 límite por minuto (espera ${Math.max(espera, 1).toFixed(0)} s)`);
            await esperar(Math.max(espera, 1) * 1000);
            continue;
          }
          if (r.status >= 500) {
            ultimoError = new Error(`Gemini respondió ${r.status}`);
            opciones.alReintentar?.(`HTTP ${r.status}`);
            continue;
          }
          const datos = (await r.json()) as {
            candidates?: { content?: Contenido }[];
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
            error?: { message?: string };
          };
          if (!r.ok) throw new Error(`Gemini respondió ${r.status}: ${datos.error?.message ?? "sin detalle"}`);
          const contenido = datos.candidates?.[0]?.content;
          if (!contenido?.parts?.length) {
            ultimoError = new Error("Gemini devolvió una respuesta vacía");
            opciones.alReintentar?.("respuesta vacía");
            continue;
          }
          const u = datos.usageMetadata;
          return {
            contenido: { role: "model", parts: contenido.parts },
            uso: { entrada: u?.promptTokenCount ?? 0, salida: u?.candidatesTokenCount ?? 0, pensamiento: u?.thoughtsTokenCount ?? 0 },
          };
        } catch (e) {
          // Los errores 4xx no se reintentan: el pedido está mal (o no hay cupo) y va a seguir igual.
          if (e instanceof CupoAgotado || (e instanceof Error && /respondió 4\d\d/.test(e.message))) throw e;
          ultimoError = e;
          opciones.alReintentar?.(e instanceof Error && e.name === "TimeoutError" ? `timeout de ${(opciones.timeoutMs ?? 25_000) / 1000} s` : "error de red");
        }
      }
      throw ultimoError instanceof Error ? ultimoError : new Error("Gemini no respondió");
    },
  };
}

export interface Grabacion {
  modelo: string;
  versionPrompt: string;
  grabadoEl: string;
  respuestas: RespuestaModelo[];
}

/** Repite, en orden, las respuestas de una grabación. */
export function crearModeloGrabado(grabacion: Grabacion): Modelo {
  let i = 0;
  return {
    nombre: `${grabacion.modelo} (grabado)`,
    async generar() {
      const respuesta = grabacion.respuestas[i++];
      if (!respuesta) throw new Error("La grabación se terminó antes que la conversación: cambió el flujo, hay que volver a grabar.");
      return structuredClone(respuesta);
    },
  };
}

/** Envuelve un modelo real y guarda cada respuesta para armar la grabación. */
export function grabarModelo(modelo: Modelo): { modelo: Modelo; respuestas: RespuestaModelo[] } {
  const respuestas: RespuestaModelo[] = [];
  return {
    respuestas,
    modelo: {
      nombre: modelo.nombre,
      async generar(pedido) {
        const respuesta = await modelo.generar(pedido);
        respuestas.push(structuredClone(respuesta));
        return respuesta;
      },
    },
  };
}
