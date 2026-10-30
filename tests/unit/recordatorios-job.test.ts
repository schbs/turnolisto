import { describe, expect, it } from "vitest";
import { correrRecordatorios } from "@/bot/recordatorios";
import { procesarMensaje } from "@/bot/procesar";
import { TranscriptorFake } from "@/audio/transcriptor";
import { CalendarioFake } from "@/calendario/calendario";
import { configAgenda } from "@/config/clinica";
import { RepositorioMemoria } from "@/datos/repositorio";
import { crearMensajeroCloudApi, cuerpoCloudApi, DestinoNoPermitido, MensajeroFake, type Mensajero } from "@/whatsapp/mensajero";
import { local } from "../fixtures/agenda";

function deps(ahora: string, mensajero: Mensajero = new MensajeroFake()) {
  return { repo: new RepositorioMemoria(), calendario: new CalendarioFake(), mensajero, config: configAgenda, ahora: () => ahora };
}

describe("job de recordatorios", () => {
  // Con los datos de prueba: el lunes 2/11 a las 12:00 entran los turnos del martes y miércoles.
  const AHORA = local("2026-11-02 12:00");

  it("manda con botones Confirmo / Reprogramar y no repite en la corrida siguiente", async () => {
    const d = deps(AHORA);
    const primera = await correrRecordatorios(d);
    expect(primera.enviados.length).toBeGreaterThan(0);
    const msj = (d.mensajero as MensajeroFake).enviados[0];
    expect(msj.interactivo?.tipo === "botones" && msj.interactivo.botones.map((b) => b.titulo)).toEqual(["Confirmo", "Reprogramar"]);
    const segunda = await correrRecordatorios(d);
    expect(segunda.enviados).toEqual([]);
  });

  it("con plantilla arma el pedido de Meta con parámetros y payloads de los botones", async () => {
    const d = deps(AHORA);
    await correrRecordatorios(d, { plantilla: "recordatorio_turno" });
    const cuerpo = cuerpoCloudApi((d.mensajero as MensajeroFake).enviados[0]) as { type: string; template: { name: string; components: { type: string; parameters: { payload?: string }[] }[] } };
    expect(cuerpo.type).toBe("template");
    expect(cuerpo.template.name).toBe("recordatorio_turno");
    expect(cuerpo.template.components.filter((c) => c.type === "button").map((c) => c.parameters[0].payload?.split("|")[0])).toEqual(["confirmar", "reprogramar"]);
  });

  it("si el envío falla, libera el recordatorio y la próxima corrida lo reintenta", async () => {
    let falla = true;
    const fake = new MensajeroFake();
    const inestable: Mensajero = { enviar: async (m) => (falla ? Promise.reject(new Error("WhatsApp caído")) : fake.enviar(m)) };
    const d = deps(AHORA, inestable);
    const primera = await correrRecordatorios(d);
    expect(primera.enviados).toEqual([]);
    expect(primera.fallidos.length).toBeGreaterThan(0);
    falla = false;
    const segunda = await correrRecordatorios(d);
    expect(segunda.enviados.length).toBe(primera.fallidos.length);
  });

  it("tocar Confirmo en el recordatorio confirma el turno", async () => {
    const d = deps(AHORA);
    await correrRecordatorios(d);
    const msj = (d.mensajero as MensajeroFake).enviados[0];
    const boton = msj.interactivo?.tipo === "botones" ? msj.interactivo.botones[0] : null;
    const turnoId = boton!.id.split("|")[1];
    const r = await procesarMensaje(
      { id: "w-conf", de: msj.para, timestamp: 0, tipo: "boton", idRespuesta: boton!.id, titulo: boton!.titulo },
      { ...d, modelo: { nombre: "sin-uso", generar: () => Promise.reject(new Error("no debería llamarse")) }, transcriptor: new TranscriptorFake() },
    );
    expect(r.enviado?.texto).toMatch(/confirmado/);
    expect((await d.repo.agenda()).turnos.find((t) => t.id === turnoId)?.estado).toBe("confirmado");
  });
});

describe("modo demo: destinos permitidos", () => {
  it("el mensajero real se niega a escribirle a un número que no está autorizado (sin llamar a Meta)", async () => {
    const m = crearMensajeroCloudApi({ token: "x", phoneNumberId: "1", permitidos: ["5492990000000"] });
    await expect(m.enviar({ para: "5492995550101", texto: "hola" })).rejects.toBeInstanceOf(DestinoNoPermitido);
  });

  it("el job no reintenta los recordatorios a números no autorizados", async () => {
    const bloqueado: Mensajero = { enviar: async () => Promise.reject(new DestinoNoPermitido("no")) };
    const d = deps(local("2026-11-02 12:00"), bloqueado);
    const primera = await correrRecordatorios(d);
    expect(primera.sinPermiso).toBeGreaterThan(0);
    expect(primera.fallidos).toEqual([]);
    expect((await correrRecordatorios(d)).sinPermiso).toBe(0);
  });
});
