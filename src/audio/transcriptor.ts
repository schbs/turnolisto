// Transcripción de notas de voz con Whisper en Groq. Si algo falla devuelve null y el bot pide que lo escriban.

export interface Transcriptor {
  transcribir(mediaId: string): Promise<string | null>;
}

export function crearTranscriptorGroq(opciones: {
  apiKey: string;
  descargar: (mediaId: string) => Promise<{ datos: ArrayBuffer; tipo: string }>;
  modelo?: string;
}): Transcriptor {
  return {
    async transcribir(mediaId) {
      try {
        const audio = await opciones.descargar(mediaId);
        const formulario = new FormData();
        formulario.append("file", new Blob([audio.datos], { type: audio.tipo }), "nota-de-voz.ogg");
        formulario.append("model", opciones.modelo ?? "whisper-large-v3-turbo");
        formulario.append("language", "es");
        formulario.append("response_format", "json");
        const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${opciones.apiKey}` },
          body: formulario,
          signal: AbortSignal.timeout(30_000),
        });
        if (!r.ok) return null;
        const texto = ((await r.json()) as { text?: string }).text?.trim();
        return texto ? texto : null;
      } catch {
        return null;
      }
    },
  };
}

/** Para tests y el simulador: devuelve transcripciones fijas por mediaId (o null para simular una falla). */
export class TranscriptorFake implements Transcriptor {
  constructor(private textos: Record<string, string | null> = {}) {}
  async transcribir(mediaId: string) {
    return this.textos[mediaId] ?? null;
  }
}
