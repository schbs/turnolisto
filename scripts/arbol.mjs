// Árbol de carpetas hasta 2 niveles, sin node_modules ni compilados (reemplaza a `tree -L 2 -I node_modules` en Windows).
import fs from "node:fs";
import path from "node:path";

const ignorar = new Set(["node_modules", ".next", ".git", "coverage"]);
const niveles = Number(process.argv[2] ?? 2);

function listar(dir, prefijo, nivel) {
  const entradas = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => !ignorar.has(e.name) && !e.name.startsWith(".env.local"))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  entradas.forEach((e, i) => {
    const ultima = i === entradas.length - 1;
    console.log(`${prefijo}${ultima ? "└── " : "├── "}${e.name}${e.isDirectory() ? "/" : ""}`);
    if (e.isDirectory() && nivel < niveles) listar(path.join(dir, e.name), prefijo + (ultima ? "    " : "│   "), nivel + 1);
  });
}

console.log(".");
listar(".", "", 1);
