// Deja la base de Supabase con los datos ficticios de data/seed (borra todo lo anterior) y se asegura de que exista
// el usuario demo de recepción. Lo usan los tests e2e antes de correr.
// Uso: npm run db:seed
// El usuario demo: PANEL_DEMO_EMAIL / PANEL_DEMO_PASSWORD de .env.local; si faltan, se crean y se guardan ahí
// (la contraseña nunca se imprime).
import crypto from "node:crypto";
import fs from "node:fs";
import conversaciones from "../data/seed/conversaciones.json";
import handoffs from "../data/seed/handoffs.json";
import listaEspera from "../data/seed/lista_espera.json";
import mensajes from "../data/seed/mensajes.json";
import pacientes from "../data/seed/pacientes.json";
import prestaciones from "../data/seed/prestaciones.json";
import profesionales from "../data/seed/profesionales.json";
import turnos from "../data/seed/turnos.json";
import { supabaseServicio } from "../src/datos/supabase";

function cargarEnv() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // los chequeos de supabaseServicio() avisan qué falta
  }
}

function guardarEnEnv(nombre: string, valor: string) {
  let env = fs.readFileSync(".env.local", "utf8");
  const linea = new RegExp(`^${nombre}=.*$`, "m");
  env = linea.test(env) ? env.replace(linea, () => `${nombre}=${valor}`) : `${env.trimEnd()}\n${nombre}=${valor}\n`;
  fs.writeFileSync(".env.local", env);
  process.env[nombre] = valor;
}

async function main() {
  cargarEnv();
  const db = supabaseServicio();
  const t0 = Date.now();

  const ok = async (paso: string, p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    if (error) throw new Error(`${paso}: ${error.message}`);
  };

  // Borrar en orden inverso a las claves foráneas. Cada delete necesita un filtro: se usa uno que abarca todo.
  for (const [tabla, columna] of [
    ["ofertas", "entrada_id"],
    ["conversaciones", "telefono"],
    ["mensajes_procesados", "id"],
    ["mensajes", "telefono"],
    ["handoffs", "telefono"],
    ["lista_espera", "id"],
    ["turnos", "id"],
    ["pacientes", "id"],
    ["profesional_prestaciones", "profesional_id"],
    ["prestaciones", "id"],
    ["profesionales", "id"],
    ["staff", "email"],
  ] as const) {
    await ok(`borrar ${tabla}`, db.from(tabla).delete().neq(columna, ""));
  }

  await ok("profesionales", db.from("profesionales").insert(profesionales.map((p) => ({ id: p.id, nombre: p.nombre, matricula_ficticia: p.matriculaFicticia }))));
  await ok("prestaciones", db.from("prestaciones").insert(prestaciones.map((p) => ({ id: p.id, nombre: p.nombre, duracion_min: p.duracionMin, precio_ars: p.precioArs }))));
  await ok(
    "profesional_prestaciones",
    db.from("profesional_prestaciones").insert(profesionales.flatMap((p) => p.prestaciones.map((s) => ({ profesional_id: p.id, prestacion_id: s })))),
  );
  await ok(
    "pacientes",
    db.from("pacientes").insert(pacientes.map((p) => ({ id: p.id, nombre: p.nombre, telefono: p.telefono, email: p.email, obra_social: p.obraSocial, opt_in_whatsapp: p.optInWhatsapp }))),
  );
  await ok(
    "turnos",
    db.from("turnos").insert(
      turnos.map((t) => ({
        id: t.id,
        paciente_id: t.pacienteId,
        profesional_id: t.profesionalId,
        prestacion_id: t.prestacionId,
        inicio: t.inicio,
        fin: t.fin,
        estado: t.estado,
        creado_en: t.creadoEn,
      })),
    ),
  );
  await ok(
    "lista_espera",
    db.from("lista_espera").insert(
      listaEspera.map((e) => ({
        id: e.id,
        paciente_id: e.pacienteId,
        prestacion_id: e.prestacionId,
        profesional_id: e.profesionalId ?? null,
        desde: e.desde,
        hasta: e.hasta,
        estado: e.estado,
        creado_en: e.creadoEn,
      })),
    ),
  );
  await ok(
    "handoffs",
    db.from("handoffs").insert(
      handoffs.map((h) => ({
        telefono: h.telefono,
        paciente_id: h.pacienteId,
        motivo: h.motivo,
        resumen: h.resumen,
        estado: h.estado,
        creado_en: h.creadoEn,
        resuelto_en: h.estado === "resuelto" ? h.creadoEn : null,
      })),
    ),
  );
  await ok(
    "mensajes",
    db.from("mensajes").insert(mensajes.map((m) => ({ telefono: m.telefono, paciente_id: m.pacienteId, direccion: m.direccion, tipo: m.tipo, texto: m.texto, creado_en: m.creadoEn }))),
  );
  await ok("conversaciones", db.from("conversaciones").insert(conversaciones.map((c) => ({ telefono: c.telefono, pausado: c.pausado, historial: c.historial }))));

  // Usuario demo de recepción (Supabase Auth) y su alta como personal.
  if (!process.env.PANEL_DEMO_EMAIL) guardarEnEnv("PANEL_DEMO_EMAIL", "recepcion.demo@example.com");
  if (!process.env.PANEL_DEMO_PASSWORD) guardarEnEnv("PANEL_DEMO_PASSWORD", crypto.randomBytes(18).toString("base64url"));
  const email = process.env.PANEL_DEMO_EMAIL!;
  const { data: usuarios, error: errorLista } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (errorLista) throw new Error(`listar usuarios: ${errorLista.message}`);
  const existente = usuarios.users.find((u) => u.email === email);
  if (existente) {
    const { error } = await db.auth.admin.updateUserById(existente.id, { password: process.env.PANEL_DEMO_PASSWORD });
    if (error) throw new Error(`actualizar usuario demo: ${error.message}`);
  } else {
    const { error } = await db.auth.admin.createUser({ email, password: process.env.PANEL_DEMO_PASSWORD, email_confirm: true });
    if (error) throw new Error(`crear usuario demo: ${error.message}`);
  }
  await ok("staff", db.from("staff").insert({ email, nombre: "Recepción (demo)" }));

  console.log(
    `Base cargada en ${Date.now() - t0} ms: ${profesionales.length} profesionales, ${prestaciones.length} prestaciones, ${pacientes.length} pacientes, ` +
      `${turnos.length} turnos, ${listaEspera.length} en lista de espera, ${handoffs.length} derivaciones, ${mensajes.length} mensajes. ` +
      `Usuario demo de recepción: ${existente ? "actualizado" : "creado"} (credenciales en .env.local).`,
  );
}

void main().catch((e) => {
  console.error("Falló la carga:", e instanceof Error ? e.message : e);
  process.exit(1);
});
