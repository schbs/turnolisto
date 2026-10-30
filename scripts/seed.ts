// Genera los datos ficticios de la demo: 3 profesionales, 8 prestaciones, 40 pacientes, 60 turnos, una lista de espera
// y 3 derivaciones a recepción con sus mensajes (para el panel).
// Es determinista (semilla fija): correrlo dos veces da los mismos archivos.
// Salida: data/seed/*.json y supabase/seed.sql.
import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { configAgenda, ZONA_CLINICA } from "../src/config/clinica";
import { reservar } from "../src/domain/agenda";
import { normalizarTelefonoAR } from "../src/domain/telefono";
import type { Agenda, EntradaEspera, Prestacion, Profesional, Turno } from "../src/domain/tipos";

const raiz = path.resolve(import.meta.dirname, "..");

function mulberry32(semilla: number) {
  return () => {
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = mulberry32(20261030);
const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)];

const local = (fechaHora: string) => DateTime.fromFormat(fechaHora, "yyyy-MM-dd HH:mm", { zone: ZONA_CLINICA });

type PrestacionSeed = Prestacion & { precioArs: number };

const prestaciones: PrestacionSeed[] = [
  { id: "consulta", nombre: "Consulta y diagnóstico", duracionMin: 30, precioArs: 25000 },
  { id: "limpieza", nombre: "Limpieza dental", duracionMin: 45, precioArs: 38000 },
  { id: "arreglo", nombre: "Arreglo (obturación)", duracionMin: 45, precioArs: 52000 },
  { id: "extraccion", nombre: "Extracción simple", duracionMin: 60, precioArs: 60000 },
  { id: "conducto", nombre: "Tratamiento de conducto", duracionMin: 90, precioArs: 180000 },
  { id: "blanqueamiento", nombre: "Blanqueamiento", duracionMin: 60, precioArs: 150000 },
  { id: "ortodoncia", nombre: "Control de ortodoncia", duracionMin: 30, precioArs: 30000 },
  { id: "urgencia", nombre: "Urgencia (dolor)", duracionMin: 30, precioArs: 35000 },
];

const profesionales: (Profesional & { matriculaFicticia: string })[] = [
  {
    id: "prof-ferreyra",
    nombre: "Dra. Lucía Ferreyra",
    matriculaFicticia: "MP-0000-FICT",
    prestaciones: ["consulta", "limpieza", "arreglo", "blanqueamiento", "urgencia"],
  },
  {
    id: "prof-quintana",
    nombre: "Dr. Martín Quintana",
    matriculaFicticia: "MP-0001-FICT",
    prestaciones: ["consulta", "arreglo", "extraccion", "conducto", "urgencia"],
  },
  {
    id: "prof-ibanez",
    nombre: "Dra. Sofía Ibáñez",
    matriculaFicticia: "MP-0002-FICT",
    prestaciones: ["consulta", "limpieza", "ortodoncia"],
  },
];

const nombres = ["Agustina", "Joaquín", "Valentina", "Tomás", "Camila", "Matías", "Martina", "Nicolás", "Lucía", "Ramiro", "Belén", "Iñaki", "Julieta", "Andrés", "Florencia", "Germán", "Rocío", "Ezequiel", "Milagros", "Simón"];
const apellidos = ["Gómez", "Pérez", "Sosa", "Núñez", "Ríos", "Acuña", "Benítez", "Molina", "Carrizo", "Peña", "Zárate", "Villalba", "Ortiz", "Rodríguez", "Funes", "Godoy"];
const coberturas = ["Particular", "Salud Confluencia (ficticia)", "Prepaga Limay (ficticia)", "OS Valle Demo (ficticia)"];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const pacientes = Array.from({ length: 40 }, (_, i) => {
  const nombre = `${elegir(nombres)} ${elegir(apellidos)}`;
  const numero = String(i).padStart(2, "0");
  const [n, a] = nombre.split(" ").map(sinTildes);
  return {
    id: `pac-${String(i + 1).padStart(3, "0")}`,
    nombre,
    telefono: normalizarTelefonoAR(`0299 15 555-01${numero}`)!,
    email: `${n}.${a}.${numero}@example.com`,
    obraSocial: elegir(coberturas),
    optInWhatsapp: azar() < 0.9,
  };
});

// Turnos: tres semanas (26/10 al 14/11/2026). Se reservan con el dominio, así respetan horario, grilla y superposición.
const creacion = local("2026-10-26 07:00").toUTC().toISO()!;
const referencia = local("2026-11-02 08:00"); // "hoy" en la demo
const dias = Array.from({ length: 20 }, (_, i) => local("2026-10-26 00:00").plus({ days: i })).filter((d) => d.weekday !== 7);

let agenda: Agenda = { turnos: [], listaEspera: [] };
let intentos = 0;
while (agenda.turnos.length < 60 && intentos < 5000) {
  intentos++;
  const profesional = elegir(profesionales);
  const prestacionId = elegir(profesional.prestaciones);
  const prestacion = prestaciones.find((p) => p.id === prestacionId)!;
  const dia = elegir(dias);
  const horario = configAgenda.horario[dia.weekday as keyof typeof configAgenda.horario]!;
  const [hAbre] = horario.abre.split(":").map(Number);
  const [hCierra] = horario.cierra.split(":").map(Number);
  const cuartos = Math.floor(azar() * (hCierra - hAbre) * 4);
  const inicio = dia.set({ hour: hAbre }).plus({ minutes: cuartos * 15 });
  const r = reservar(
    agenda,
    { id: `tur-${String(agenda.turnos.length + 1).padStart(3, "0")}`, pacienteId: elegir(pacientes).id, profesionalId: profesional.id, prestacion, inicio: inicio.toUTC().toISO()! },
    configAgenda,
    creacion,
  );
  if (r.ok) agenda = r.agenda;
}

const turnos: Turno[] = agenda.turnos
  .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))
  .map((t) => {
    const pasado = Date.parse(t.inicio) < referencia.toMillis();
    const x = azar();
    const estado: Turno["estado"] = pasado ? (x < 0.85 ? "confirmado" : "ausente") : x < 0.5 ? "reservado" : x < 0.9 ? "confirmado" : "cancelado";
    return { ...t, estado };
  });

const listaEspera: EntradaEspera[] = Array.from({ length: 6 }, (_, i) => {
  const prestacionId = elegir(["consulta", "limpieza", "arreglo", "ortodoncia"]);
  const quienes = profesionales.filter((p) => p.prestaciones.includes(prestacionId));
  return {
    id: `esp-${String(i + 1).padStart(3, "0")}`,
    pacienteId: elegir(pacientes).id,
    prestacionId,
    profesionalId: azar() < 0.5 ? elegir(quienes).id : undefined,
    desde: "2026-11-02",
    hasta: "2026-11-14",
    creadoEn: local("2026-10-27 10:00").plus({ hours: i * 7 }).toUTC().toISO()!,
    estado: "esperando",
  };
});

// Derivaciones a recepción y sus mensajes, para que el panel tenga una cola que mostrar.
const enLocal = (fechaHora: string) => local(fechaHora).toUTC().toISO()!;
const conversacionesDemo = [
  {
    paciente: pacientes[4],
    motivo: "otro",
    estado: "pendiente",
    creadoEn: enLocal("2026-10-30 10:12"),
    resumen: "Pregunta si la obra social le cubre el arreglo que le hicieron la semana pasada.",
    mensajes: [
      ["entrante", "Hola, ¿la obra social me cubre el arreglo que me hicieron la semana pasada? Me llegó un cobro."],
      ["saliente", "Eso lo revisa recepción con tu obra social. Ya les paso tu consulta y te escriben por acá."],
    ],
  },
  {
    paciente: pacientes[8],
    motivo: "pedido_del_paciente",
    estado: "pendiente",
    creadoEn: enLocal("2026-10-30 11:40"),
    resumen: "Quiere hablar con alguien por un presupuesto de ortodoncia.",
    mensajes: [
      ["entrante", "Quiero hablar con una persona por un presupuesto de ortodoncia"],
      ["saliente", "¡Claro! Le paso tu consulta a recepción y una persona te escribe por acá a la brevedad."],
    ],
  },
  {
    paciente: pacientes[12],
    motivo: "urgencia",
    estado: "resuelto",
    creadoEn: enLocal("2026-10-29 19:05"),
    resumen: "Dolor fuerte en una muela; se le pasó el teléfono de guardia.",
    mensajes: [
      ["entrante", "Me duele mucho una muela, no aguanto"],
      ["saliente", "Lamento mucho el dolor. Ya le aviso a recepción para que te atiendan lo antes posible; si es urgente, llamá ahora a la guardia: +54 9 299 555-0199 (guardia odontológica ficticia, las 24 h)."],
    ],
  },
] as const;

const handoffs = conversacionesDemo.map((c) => ({
  telefono: c.paciente.telefono,
  pacienteId: c.paciente.id,
  motivo: c.motivo,
  resumen: c.resumen,
  estado: c.estado,
  creadoEn: c.creadoEn,
}));
const mensajes = conversacionesDemo.flatMap((c) =>
  c.mensajes.map(([direccion, texto], i) => ({
    telefono: c.paciente.telefono,
    pacienteId: c.paciente.id,
    direccion,
    tipo: "texto",
    texto,
    creadoEn: DateTime.fromISO(c.creadoEn).minus({ minutes: 2 - i }).toUTC().toISO()!,
  })),
);
const conversaciones = conversacionesDemo.map((c) => ({
  telefono: c.paciente.telefono,
  pausado: c.estado === "pendiente",
  historial: c.mensajes.map(([direccion, texto]) => ({ rol: direccion === "entrante" ? "usuario" : "asistente", texto })),
}));

// --- Salida ---
const dirSeed = path.join(raiz, "data", "seed");
fs.mkdirSync(dirSeed, { recursive: true });
const escribir = (nombre: string, datos: unknown) => fs.writeFileSync(path.join(dirSeed, nombre), JSON.stringify(datos, null, 2) + "\n");
escribir("profesionales.json", profesionales);
escribir("prestaciones.json", prestaciones);
escribir("pacientes.json", pacientes);
escribir("turnos.json", turnos);
escribir("lista_espera.json", listaEspera);
escribir("handoffs.json", handoffs);
escribir("mensajes.json", mensajes);
escribir("conversaciones.json", conversaciones);

const sqlTexto = (v: string | number | boolean | null | undefined) =>
  v === null || v === undefined ? "null" : typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : String(v);
const insert = (tabla: string, columnas: string[], filas: (string | number | boolean | null | undefined)[][]) =>
  `insert into ${tabla} (${columnas.join(", ")}) values\n${filas.map((f) => `  (${f.map(sqlTexto).join(", ")})`).join(",\n")};\n`;

const sql = [
  "-- Datos ficticios de demostración. Generado por scripts/seed.ts: no editar a mano.\n",
  insert("profesionales", ["id", "nombre", "matricula_ficticia"], profesionales.map((p) => [p.id, p.nombre, p.matriculaFicticia])),
  insert("prestaciones", ["id", "nombre", "duracion_min", "precio_ars"], prestaciones.map((p) => [p.id, p.nombre, p.duracionMin, p.precioArs])),
  insert("profesional_prestaciones", ["profesional_id", "prestacion_id"], profesionales.flatMap((p) => p.prestaciones.map((s) => [p.id, s]))),
  insert(
    "pacientes",
    ["id", "nombre", "telefono", "email", "obra_social", "opt_in_whatsapp"],
    pacientes.map((p) => [p.id, p.nombre, p.telefono, p.email, p.obraSocial, p.optInWhatsapp]),
  ),
  insert(
    "turnos",
    ["id", "paciente_id", "profesional_id", "prestacion_id", "inicio", "fin", "estado", "creado_en"],
    turnos.map((t) => [t.id, t.pacienteId, t.profesionalId, t.prestacionId, t.inicio, t.fin, t.estado, t.creadoEn]),
  ),
  insert(
    "lista_espera",
    ["id", "paciente_id", "prestacion_id", "profesional_id", "desde", "hasta", "estado", "creado_en"],
    listaEspera.map((e) => [e.id, e.pacienteId, e.prestacionId, e.profesionalId, e.desde, e.hasta, e.estado, e.creadoEn]),
  ),
].join("\n");
fs.writeFileSync(path.join(raiz, "supabase", "seed.sql"), sql);

const porEstado = Object.groupBy(turnos, (t) => t.estado);
console.log(`profesionales: ${profesionales.length} · prestaciones: ${prestaciones.length} · pacientes: ${pacientes.length}`);
console.log(`turnos: ${turnos.length} (${Object.entries(porEstado).map(([e, l]) => `${e} ${l!.length}`).join(", ")}) · lista de espera: ${listaEspera.length}`);
console.log(`intentos de reserva: ${intentos} (los rechazados chocaban o caían fuera de horario)`);
console.log("→ data/seed/*.json y supabase/seed.sql");
