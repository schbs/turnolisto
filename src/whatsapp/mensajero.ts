// Envío de mensajes por WhatsApp Cloud API: texto, botones (hasta 3) y lista (hasta 10 filas).

export type Interactivo =
  | { tipo: "botones"; botones: { id: string; titulo: string }[] }
  | { tipo: "lista"; boton: string; filas: { id: string; titulo: string; descripcion?: string }[] };

/** Plantilla aprobada por Meta: la única forma de escribir fuera de la ventana de 24 h (los recordatorios). */
export interface Plantilla {
  nombre: string;
  idioma: string;
  /** Valores de {{1}}, {{2}}… del cuerpo. */
  parametros: string[];
  /** Payload de cada botón de respuesta rápida, en orden. */
  botones: string[];
}

export interface MensajeSaliente {
  /** wa_id del destinatario (número sin "+"). */
  para: string;
  /** Texto del mensaje (con plantilla: el texto armado, para el registro y los tests). */
  texto: string;
  interactivo?: Interactivo;
  plantilla?: Plantilla;
}

export interface Mensajero {
  enviar(mensaje: MensajeSaliente): Promise<void>;
}

const corta = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

/** Cuerpo del pedido a la API, respetando los límites de Meta (títulos de botón ≤ 20, de fila ≤ 24, descripción ≤ 72). */
export function cuerpoCloudApi(m: MensajeSaliente): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to: m.para };
  if (m.plantilla) {
    return {
      ...base,
      type: "template",
      template: {
        name: m.plantilla.nombre,
        language: { code: m.plantilla.idioma },
        components: [
          { type: "body", parameters: m.plantilla.parametros.map((text) => ({ type: "text", text })) },
          ...m.plantilla.botones.map((payload, index) => ({
            type: "button",
            sub_type: "quick_reply",
            index: String(index),
            parameters: [{ type: "payload", payload }],
          })),
        ],
      },
    };
  }
  if (!m.interactivo) return { ...base, type: "text", text: { body: m.texto, preview_url: false } };
  if (m.interactivo.tipo === "botones") {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: corta(m.texto, 1024) },
        action: { buttons: m.interactivo.botones.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: corta(b.titulo, 20) } })) },
      },
    };
  }
  return {
    ...base,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: corta(m.texto, 1024) },
      action: {
        button: corta(m.interactivo.boton, 20),
        sections: [
          {
            title: "Horarios",
            rows: m.interactivo.filas.slice(0, 10).map((f) => ({
              id: f.id,
              title: corta(f.titulo, 24),
              ...(f.descripcion ? { description: corta(f.descripcion, 72) } : {}),
            })),
          },
        ],
      },
    },
  };
}

/** En la demo solo se le escribe a números autorizados: los pacientes del seed son ficticios y podrían existir. */
export class DestinoNoPermitido extends Error {}

export function crearMensajeroCloudApi(opciones: { token: string; phoneNumberId: string; version?: string; permitidos?: string[] }): Mensajero {
  const url = `https://graph.facebook.com/${opciones.version ?? "v25.0"}/${opciones.phoneNumberId}/messages`;
  return {
    async enviar(mensaje) {
      if (opciones.permitidos && !opciones.permitidos.includes(mensaje.para)) {
        throw new DestinoNoPermitido(`${mensaje.para} no está en WHATSAPP_DESTINOS_PERMITIDOS: no se envía (modo demo)`);
      }
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${opciones.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(cuerpoCloudApi(mensaje)),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) {
        const error = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(`WhatsApp respondió ${r.status}: ${error?.error?.message ?? "sin detalle"}`);
      }
    },
  };
}

/** Para tests y el simulador: guarda lo que se habría enviado. */
export class MensajeroFake implements Mensajero {
  enviados: MensajeSaliente[] = [];
  async enviar(mensaje: MensajeSaliente) {
    this.enviados.push(mensaje);
  }
}
