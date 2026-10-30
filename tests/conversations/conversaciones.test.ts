// Las 18 conversaciones de negocio (16 en español y 2 en inglés), repitiendo respuestas reales de Gemini grabadas con `npm run conversaciones:grabar`.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { crearModeloGrabado, type Grabacion } from "@/agent/modelo";
import { cargarCasos, correrCaso, DIR_GRABACIONES } from "./correr";

const casos = cargarCasos();

describe("conversaciones", () => {
  it("son 18 casos", () => {
    expect(casos).toHaveLength(18);
  });

  for (const caso of casos) {
    it(caso.nombre, async () => {
      const archivo = path.join(DIR_GRABACIONES, `${caso.nombre}.json`);
      if (!fs.existsSync(archivo)) throw new Error(`Falta la grabación: npm run conversaciones:grabar -- ${caso.nombre}`);
      const grabacion = JSON.parse(fs.readFileSync(archivo, "utf8")) as Grabacion;
      const corrida = await correrCaso(caso, crearModeloGrabado(grabacion));
      expect(corrida.fallas).toEqual([]);
    });
  }
});
