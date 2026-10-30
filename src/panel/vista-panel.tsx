// Panel de recepción: KPIs, cola de derivaciones y agenda semanal. Requiere sesión de Supabase (usuario de staff).
// Los mensajes y resúmenes de las derivaciones se muestran como los escribió el paciente (no se traducen).
import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { IconoAlerta, IconoCheck, IconoCruz, IconoDiente, IconoPersona, IconoReloj } from "@/components/iconos";
import { configAgenda } from "@/config/clinica";
import type { EstadoTurno } from "@/domain/tipos";
import { nombrePrestacion } from "@/i18n/bot";
import { localeDe, ruta, type Idioma } from "@/i18n/idioma";
import { UI } from "@/i18n/ui";
import { confirmarTurno, resolverDerivacion, salir } from "./acciones";
import { cargarPanel, lunesDe, type TurnoPanel } from "./datos";
import { supabaseSesion } from "./supabase-sesion";

const zona = configAgenda.zona;
type Textos = (typeof UI)[Idioma]["panel"];

const ESTILOS: Record<EstadoTurno, { clase: string; Icono: typeof IconoCheck }> = {
  reservado: { clase: "bg-reservado-fondo text-reservado", Icono: IconoReloj },
  confirmado: { clase: "bg-confirmado-fondo text-confirmado", Icono: IconoCheck },
  cancelado: { clase: "bg-cancelado-fondo text-cancelado", Icono: IconoCruz },
  ausente: { clase: "bg-ausente-fondo text-ausente", Icono: IconoAlerta },
};

function Estado({ estado, t }: { estado: EstadoTurno; t: Textos }) {
  const { clase, Icono } = ESTILOS[estado];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-bold ${clase}`}>
      <Icono width={16} height={16} />
      {t.estados[estado]}
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

function Turno({ turno, t, idioma }: { turno: TurnoPanel; t: Textos; idioma: Idioma }) {
  return (
    <li data-turno={turno.id} data-estado={turno.estado} className="flex flex-col gap-2 rounded-xl bg-blanco p-3 ring-1 ring-linea">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="font-titulo font-semibold tabular-nums">{DateTime.fromISO(turno.inicio, { zone: zona }).setLocale(localeDe(idioma)).toFormat(t.formatoHora)}</span>
        <Estado estado={turno.estado} t={t} />
      </div>
      <p className="font-bold leading-snug">{turno.paciente}</p>
      <p className="text-sm text-tinta-suave">
        {nombrePrestacion(turno.prestacionId, turno.prestacion, idioma)} · {turno.profesional}
      </p>
      {turno.estado === "reservado" && (
        <form action={confirmarTurno}>
          <input type="hidden" name="turno" value={turno.id} />
          <button type="submit" className="min-h-11 w-full rounded-full border border-menta-700 px-3 text-sm font-bold text-menta-700 hover:bg-menta-50">
            {t.confirmar}
            <span className="sr-only">
              {" "}
              {t.elTurnoDe} {turno.paciente}
            </span>
          </button>
        </form>
      )}
    </li>
  );
}

export async function VistaPanel({ idioma, semana: semanaPedida }: { idioma: Idioma; semana?: string }) {
  const t = UI[idioma].panel;
  const otro = UI[idioma].otroIdioma;
  const supabase = await supabaseSesion();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) redirect(ruta(idioma, "/panel/ingresar"));

  const lunes = lunesDe(semanaPedida).setLocale(localeDe(idioma));
  const { turnos, kpis, derivaciones } = await cargarPanel(supabase, lunes);
  const dias = Array.from({ length: 6 }, (_, i) => lunes.plus({ days: i }));
  const porcentaje = kpis.confirmacion.total ? Math.round((kpis.confirmacion.confirmados / kpis.confirmacion.total) * 100) : 0;
  const conteo = (Object.keys(ESTILOS) as EstadoTurno[]).map((e) => [e, turnos.filter((x) => x.estado === e).length] as const);
  const semana = (d: DateTime) => `${ruta(idioma, "/panel")}?semana=${d.toFormat("yyyy-MM-dd")}`;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-linea bg-blanco">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href={ruta(idioma, "/")} className="flex items-center gap-2 font-titulo font-semibold text-menta-800">
            <IconoDiente className="text-coral-700" width={22} height={22} />
            {t.marca}
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-tinta-suave">
              <IconoPersona width={18} height={18} />
              {sesion.user.email}
            </span>
            <Link
              href={`${ruta(otro.lang as Idioma, "/panel")}${semanaPedida ? `?semana=${semanaPedida}` : ""}`}
              hrefLang={otro.lang}
              lang={otro.lang}
              className="inline-flex min-h-11 items-center rounded-full px-3 font-bold text-menta-700 underline underline-offset-4"
            >
              {otro.etiqueta}
            </Link>
            <form action={salir}>
              <input type="hidden" name="idioma" value={idioma} />
              <button type="submit" className="min-h-11 rounded-full px-3 font-bold text-menta-700 underline underline-offset-4">
                {t.salir}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8">
        <section aria-labelledby="titulo-resumen">
          <h1 id="titulo-resumen" className="font-titulo text-2xl font-semibold">
            {t.resumen}
          </h1>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Kpi titulo={t.kpis.confirmacion} valor={`${porcentaje} %`} detalle={t.kpis.confirmacionDetalle(kpis.confirmacion.confirmados, kpis.confirmacion.total)} />
            <Kpi titulo={t.kpis.recuperadas} valor={t.kpis.recuperadasValor(kpis.recuperadas.recuperadas, kpis.recuperadas.canceladas)} detalle={t.kpis.recuperadasDetalle} />
            <Kpi titulo={t.kpis.derivaciones} valor={String(kpis.derivaciones.pendientes)} detalle={t.kpis.derivacionesDetalle(kpis.derivaciones.ultimos7)} />
            <Kpi titulo={t.kpis.semana} valor={String(kpis.semana)} detalle={t.kpis.semanaDetalle} />
          </div>
        </section>

        <section aria-labelledby="titulo-derivaciones">
          <h2 id="titulo-derivaciones" className="font-titulo text-xl font-semibold">
            {t.derivaciones}
          </h2>
          {derivaciones.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-tinta-suave">
              <IconoCheck className="text-confirmado" /> {t.sinDerivaciones}
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 lg:grid-cols-2">
              {derivaciones.map((d) => (
                <li key={d.id} data-derivacion={d.id} className="flex flex-col gap-3 rounded-2xl bg-blanco p-5 ring-1 ring-linea">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold ${d.motivo === "urgencia" ? "bg-ausente-fondo text-ausente" : "bg-coral-50 text-coral-700"}`}>
                      <IconoAlerta width={16} height={16} />
                      {t.motivos[d.motivo] ?? d.motivo}
                    </span>
                    <span className="text-sm text-tinta-suave">{DateTime.fromISO(d.creadoEn, { zone: zona }).setLocale(localeDe(idioma)).toFormat(t.formatoDerivacion)}</span>
                  </div>
                  <p className="font-bold">{d.paciente ?? t.sinRegistrar}</p>
                  <p>{d.resumen}</p>
                  {d.ultimoMensaje && <blockquote className="border-l-4 border-linea pl-3 text-tinta-suave">“{d.ultimoMensaje}”</blockquote>}
                  <form action={resolverDerivacion} className="mt-auto">
                    <input type="hidden" name="derivacion" value={d.id} />
                    <input type="hidden" name="telefono" value={d.telefono} />
                    <button type="submit" className="min-h-11 rounded-full bg-menta-700 px-5 font-bold text-blanco hover:bg-menta-800">
                      {t.resolver}
                      <span className="sr-only">: {d.paciente ?? d.telefono}</span>
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
                {t.agenda}
              </h2>
              <p className="text-tinta-suave">{t.rango(lunes.toFormat(t.formatoDia), lunes.plus({ days: 5 }).toFormat(t.formatoDiaAnio))}</p>
            </div>
            <nav aria-label={t.cambiarSemana} className="flex gap-2">
              <Link href={semana(lunes.minus({ weeks: 1 }))} className="inline-flex min-h-11 items-center rounded-full px-4 font-bold text-menta-700 ring-1 ring-menta-700 hover:bg-menta-50">
                {t.anterior}
              </Link>
              <Link href={semana(lunes.plus({ weeks: 1 }))} className="inline-flex min-h-11 items-center rounded-full px-4 font-bold text-menta-700 ring-1 ring-menta-700 hover:bg-menta-50">
                {t.siguiente}
              </Link>
            </nav>
          </div>
          <ul aria-label={t.porEstado} className="mt-4 flex flex-wrap gap-2">
            {conteo.map(([estado, n]) => (
              <li key={estado} className="flex items-center gap-2">
                <Estado estado={estado} t={t} />
                <span className="font-bold tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {dias.map((dia) => {
              const delDia = turnos.filter((x) => DateTime.fromISO(x.inicio, { zone: zona }).hasSame(dia, "day"));
              return (
                <section key={dia.toISODate()} aria-label={dia.toFormat(t.formatoColumna)} className="flex flex-col gap-3 rounded-2xl bg-menta-50/60 p-3">
                  <h3 className="font-titulo font-semibold capitalize">{dia.toFormat(t.formatoColumna)}</h3>
                  {delDia.length ? (
                    <ul className="flex flex-col gap-2">
                      {delDia.map((x) => (
                        <Turno key={x.id} turno={x} t={t} idioma={idioma} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-tinta-suave">{t.sinTurnos}</p>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-linea bg-blanco px-4 py-6 text-center text-sm text-tinta-suave">{t.demo}</footer>
    </div>
  );
}
