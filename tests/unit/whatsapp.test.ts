import { describe, expect, it } from "vitest";
import { crearManejadorWebhook } from "@/bot/manejador";
import { firmar, firmaValida } from "@/whatsapp/firma";
import { cuerpoCloudApi } from "@/whatsapp/mensajero";
import { parsearWebhook } from "@/whatsapp/webhook";

const SECRETO = "secreto-de-prueba";

const payload = (mensaje: Record<string, unknown>) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "0", changes: [{ field: "messages", value: { contacts: [{ wa_id: "5492995550101", profile: { name: "Ana" } }], messages: [mensaje] } }] }],
});

describe("firma X-Hub-Signature-256", () => {
  it("acepta la firma correcta y rechaza la alterada, la de otro secreto o la ausente", () => {
    const cuerpo = '{"hola":"mundo"}';
    const firma = firmar(cuerpo, SECRETO);
    expect(firmaValida(cuerpo, firma, SECRETO)).toBe(true);
    expect(firmaValida(cuerpo + " ", firma, SECRETO)).toBe(false);
    expect(firmaValida(cuerpo, firmar(cuerpo, "otro"), SECRETO)).toBe(false);
    expect(firmaValida(cuerpo, null, SECRETO)).toBe(false);
    expect(firmaValida(cuerpo, "sha1=abc", SECRETO)).toBe(false);
  });
});

describe("parsearWebhook", () => {
  it("lee texto, audio, botón, lista, botón de plantilla y tipos no soportados", () => {
    const tipos = [
      { type: "text", text: { body: "hola" } },
      { type: "audio", audio: { id: "m1" } },
      { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "confirmar|tur-1", title: "Confirmo" } } },
      { type: "interactive", interactive: { type: "list_reply", list_reply: { id: "slot|x", title: "jue 15:00" } } },
      { type: "button", button: { payload: "reprogramar|tur-1", text: "Reprogramar" } },
      { type: "sticker", sticker: { id: "s" } },
    ];
    const leidos = tipos.flatMap((t, i) => parsearWebhook(payload({ from: "5492995550101", id: `w${i}`, timestamp: "1", ...t })));
    expect(leidos.map((m) => m.tipo)).toEqual(["texto", "audio", "boton", "boton", "boton", "otro"]);
    expect(leidos[0]).toMatchObject({ texto: "hola", nombrePerfil: "Ana", de: "5492995550101" });
    expect(leidos[4]).toMatchObject({ idRespuesta: "reprogramar|tur-1" });
  });

  it("ignora estados de entrega y payloads que no son de WhatsApp", () => {
    const estados = { object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [{ id: "x", status: "read" }] } }] }] };
    expect(parsearWebhook(estados)).toEqual([]);
    expect(parsearWebhook({ object: "page", entry: [] })).toEqual([]);
    expect(parsearWebhook("basura")).toEqual([]);
  });
});

describe("cuerpoCloudApi", () => {
  it("respeta los límites de Meta en botones y listas", () => {
    const botones = cuerpoCloudApi({
      para: "549",
      texto: "¿Venís?",
      interactivo: { tipo: "botones", botones: [1, 2, 3, 4].map((n) => ({ id: `b${n}`, titulo: "Un título demasiado largo para WhatsApp" })) },
    }) as { interactive: { action: { buttons: { reply: { title: string } }[] } } };
    expect(botones.interactive.action.buttons).toHaveLength(3);
    expect(botones.interactive.action.buttons[0].reply.title.length).toBeLessThanOrEqual(20);

    const lista = cuerpoCloudApi({
      para: "549",
      texto: "Horarios",
      interactivo: { tipo: "lista", boton: "Ver horarios", filas: Array.from({ length: 12 }, (_, i) => ({ id: `f${i}`, titulo: `fila ${i}` })) },
    }) as { interactive: { action: { sections: { rows: unknown[] }[] } } };
    expect(lista.interactive.action.sections[0].rows).toHaveLength(10);
    expect(cuerpoCloudApi({ para: "549", texto: "hola" })).toMatchObject({ type: "text", text: { body: "hola" } });
  });
});

describe("manejador del webhook", () => {
  const procesados: string[] = [];
  const manejador = crearManejadorWebhook({
    verifyToken: "token-verificacion",
    appSecret: SECRETO,
    procesar: async (m) => procesados.push(m.id),
    enSegundoPlano: (t) => t.then(() => undefined),
  });

  it("verificación GET: devuelve el challenge solo con el token correcto", async () => {
    const ok = manejador.GET(new Request("http://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=token-verificacion&hub.challenge=123"));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("123");
    expect(manejador.GET(new Request("http://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=123")).status).toBe(403);
  });

  it("POST: 401 sin firma válida (y no procesa); 200 con firma", async () => {
    const cuerpo = JSON.stringify(payload({ from: "5492995550101", id: "wamid.1", timestamp: "1", type: "text", text: { body: "hola" } }));
    const malo = await manejador.POST(new Request("http://x", { method: "POST", body: cuerpo, headers: { "x-hub-signature-256": "sha256=00" } }));
    expect(malo.status).toBe(401);
    expect(procesados).toEqual([]);
    const bueno = await manejador.POST(new Request("http://x", { method: "POST", body: cuerpo, headers: { "x-hub-signature-256": firmar(cuerpo, SECRETO) } }));
    expect(bueno.status).toBe(200);
    expect(procesados).toEqual(["wamid.1"]);
  });
});
