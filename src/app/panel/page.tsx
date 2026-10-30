// Panel de recepción: KPIs, cola de derivaciones y agenda semanal. Requiere sesión de Supabase (usuario de staff).
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { IconoAlerta, IconoCheck, IconoCruz, IconoDiente, IconoPersona, IconoReloj } from "@/components/iconos";
import { configAgenda } from "@/config/clinica";
import type { EstadoTurno } from "@/domain/tipos";
import { confirmarTurno, resolverDerivacion, salir } from "./acciones";
import { cargarPanel, lunesDe, type TurnoPanel } from "./datos";
import { supabaseSesion } from "./supabase-sesion";

export const metadata: Metadata = {
  title: "Panel de recepción",
  description: "Agenda semanal, confirmaciones y derivaciones del asistente de WhatsApp (demo con datos ficticios).",
};

const zona = configAgenda.zona;

const ESTADOS: Record<EstadoTurno, { texto: string; clase: string; Icono: typeof IconoCheck }> = {
  reservado: { texto: "Reservado", clase: "bg-reservado-fondo text-reservado", Icono: IconoReloj },
  confirmado: { texto: "Confirmado", clase: "bg-confirmado-fondo text-confirmado", Icono: IconoCheck },
  cancelado: { texto: "Cancelado", clase: "bg-cancelado-fondo text-cancelado", Icono: IconoCruz },
  ausente: { texto: "Ausente", clase: "bg-ausente-fondo text-ausente", Icono: IconoAlerta },
};

const MOTIVOS: Record<string, string> = {
  urgencia: "Urgencia",
  pedido_del_paciente: "Pidió una persona",
  queja: "Queja",
  no_entiendo: "El asistente no entendió",
  otro: "Otro",
};

function Estado({ estado }: { estado: EstadoTurno }) {
  const { texto, clase, Icono } = ESTADOS[estado];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-bold ${clase}`}>
      <Icono width={16} height={16} />
      {texto}
    </span>
  );
}

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-2xl bg-blanco p-4 ring-1 ring-linea lg:p-5">
      <p className="text-sm font-bold text-tinta-suave">{titulo}</p>
      <p className="mt-1 font-titulo text-2xl font-semibold tabular-nums lg:text-3xl">{valor}</p>
      <p className="mt-1 text-sm text-tinta-suave">{detalle}</p>
    </div>
  );
}

function Turno({ t }: { t: TurnoPanel }) {
  return (
    <li data-turno={t.id} data-estado={t.estado} className="flex flex-col gap-2 rounded-xl bg-blanco p-3 ring-1 ring-linea">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="font-titulo font-semibold tabular-nums">{DateTime.fromISO(t.inicio, { zone: zona }).toFormat("HH:mm")}</span>
        <Estado estado={t.estado} />
      </div>
      <p className="font-bold leading-snug">{t.paciente}</p>
      <p className="text-sm text-tinta-suave">
        {t.prestacion} · {t.profesional}
      </p>
      {t.estado === "reservado" && (
        <form action={confirmarTurno}>
          <input type="hidden" name="turno" value={t.id} />
          <button type="submit" className="min-h-11 w-full rounded-full border border-menta-700 px-3 text-sm font-bold text-menta-700 hover:bg-menta-50">
            Confirmar<span className="sr-only"> el turno de {t.paciente}</span>
          </button>
        </form>
      )}
    </li>
  );
}

export default async function Panel({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const supabase = await supabaseSesion();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) redirect("/panel/ingresar");

  const lunes = lunesDe((await searchParams).semana);
  const { turnos, kpis, derivaciones } = await cargarPanel(supabase, lunes);
  const dias = Array.from({ length: 6 }, (_, i) => lunes.plus({ days: i }));
  const porcentaje = kpis.confirmacion.total ? Math.round((kpis.confirmacion.confirmados / kpis.confirmacion.total) * 100) : 0;
  const conteo = (Object.keys(ESTADOS) as EstadoTurno[]).map((e) => [e, turnos.filter((t) => t.estado === e).length] as const);
  const semana = (d: DateTime) => d.toFormat("yyyy-MM-dd");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-linea bg-blanco">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-titulo font-semibold text-menta-800">
            <IconoDiente className="text-coral-700" width={22} height={22} />
            Confluencia · Recepción
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-tinta-suave">
              <IconoPersona width={18} height={18} />
              {sesion.user.email}
            </span>
            <form action={salir}>
              <button type="submit" className="min-h-11 rounded-full px-3 font-bold text-menta-700 underline underline-offset-4">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8">
        <section aria-labelledby="titulo-resumen">
          <h1 id="titulo-resumen" className="font-titulo text-2xl font-semibold">
            Resumen
          </h1>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Kpi titulo="Confirmación" valor={`${porcentaje} %`} detalle={`${kpis.confirmacion.confirmados} de ${kpis.confirmacion.total} turnos de los próximos 7 días`} />
            <Kpi titulo="Cancelaciones recuperadas" valor={`${kpis.recuperadas.recuperadas} de ${kpis.recuperadas.canceladas}`} detalle="Huecos que tomó alguien de la lista de espera" />
            <Kpi titulo="Derivaciones pendientes" valor={String(kpis.derivaciones.pendientes)} detalle={`${kpis.derivaciones.ultimos7} conversaciones derivadas en 7 días`} />
            <Kpi titulo="Turnos de la semana" valor={String(kpis.semana)} detalle="Sin contar cancelados" />
          </div>
        </section>

        <section aria-labelledby="titulo-derivaciones">
          <h2 id="titulo-derivaciones" className="font-titulo text-xl font-semibold">
            Derivaciones para atender
          </h2>
          {derivaciones.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-tinta-suave">
              <IconoCheck className="text-confirmado" /> No hay conversaciones esperando a recepción.
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 lg:grid-cols-2">
              {derivaciones.map((d) => (
                <li key={d.id} data-derivacion={d.id} className="flex flex-col gap-3 rounded-2xl bg-blanco p-5 ring-1 ring-linea">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold ${d.motivo === "urgencia" ? "bg-ausente-fondo text-ausente" : "bg-coral-50 text-coral-700"}`}>
                      <IconoAlerta width={16} height={16} />
                      {MOTIVOS[d.motivo] ?? d.motivo}
                    </span>
                    <span className="text-sm text-tinta-suave">{DateTime.fromISO(d.creadoEn, { zone: zona }).setLocale("es-AR").toFormat("ccc d/M HH:mm")}</span>
                  </div>
                  <p className="font-bold">{d.paciente ?? "Paciente sin registrar"}</p>
                  <p>{d.resumen}</p>
                  {d.ultimoMensaje && <blockquote className="border-l-4 border-linea pl-3 text-tinta-suave">“{d.ultimoMensaje}”</blockquote>}
                  <form action={resolverDerivacion} className="mt-auto">
                    <input type="hidden" name="derivacion" value={d.id} />
                    <input type="hidden" name="telefono" value={d.telefono} />
                    <button type="submit" className="min-h-11 rounded-full bg-menta-700 px-5 font-bold text-blanco hover:bg-menta-800">
                      Marcar resuelta<span className="sr-only">: {d.paciente ?? d.telefono}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titulo-agenda">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="titulo-agenda" className="font-titulo text-xl font-semibold">
                Agenda de la semana
              </h2>
              <p className="text-tinta-suave">
                {lunes.toFormat("d/M")} al {lunes.plus({ days: 5 }).toFormat("d/M/yyyy")}
              </p>
            </div>
            <nav aria-label="Cambiar de semana" className="flex gap-2">
              <Link href={`/panel?semana=${semana(lunes.minus({ weeks: 1 }))}`} className="inline-flex min-h-11 items-center rounded-full px-4 font-bold text-menta-700 ring-1 ring-menta-700 hover:bg-menta-50">
                ‹ Anterior
              </Link>
              <Link href={`/panel?semana=${semana(lunes.plus({ weeks: 1 }))}`} className="inline-flex min-h-11 items-center rounded-full px-4 font-bold text-menta-700 ring-1 ring-menta-700 hover:bg-menta-50">
                Siguiente ›
              </Link>
            </nav>
          </div>
          <ul aria-label="Turnos por estado" className="mt-4 flex flex-wrap gap-2">
            {conteo.map(([estado, n]) => (
              <li key={estado} className="flex items-center gap-2">
                <Estado estado={estado} />
                <span className="font-bold tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {dias.map((dia) => {
              const delDia = turnos.filter((t) => DateTime.fromISO(t.inicio, { zone: zona }).hasSame(dia, "day"));
              return (
                <section key={dia.toISODate()} aria-label={dia.setLocale("es-AR").toFormat("cccc d/M")} className="flex flex-col gap-3 rounded-2xl bg-menta-50/60 p-3">
                  <h3 className="font-titulo font-semibold capitalize">{dia.setLocale("es-AR").toFormat("cccc d/M")}</h3>
                  {delDia.length ? (
                    <ul className="flex flex-col gap-2">
                      {delDia.map((t) => (
                        <Turno key={t.id} t={t} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-tinta-suave">Sin turnos</p>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-linea bg-blanco px-4 py-6 text-center text-sm text-tinta-suave">Proyecto de demostración — marca ficticia</footer>
    </div>
  );
}
