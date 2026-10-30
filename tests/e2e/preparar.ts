// Antes de los e2e: base de Supabase con el seed y usuario demo listo.
import { execSync } from "node:child_process";

export default function preparar() {
  execSync("npx tsx scripts/db-seed.ts", { stdio: "inherit" });
}
