// Landing de la clínica ficticia: el WhatsApp es la puerta de entrada; el "ticket de turno" muestra lo que recibe el paciente.
import Link from "next/link";
import clinica from "../../data/clinica.json";
import prestaciones from "../../data/seed/prestaciones.json";
import { IconoCalendario, IconoCampana, IconoChat, IconoCheck, IconoDiente, IconoFlecha } from "@/components/iconos";
import { enlaceWhatsapp, sitio } from "@/config/sitio";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const pasos = [
  { icono: IconoChat, titulo: "Escribinos", texto: "Contale al asistente qué necesitás, con un mensaje o un audio. Atiende a toda hora." },
  { icono: IconoCalendario, titulo: "Elegí el horario", texto: "Te muestra los turnos libres reales y lo reserva al toque. También lo cambia o lo cancela." },
  { icono: IconoCampana, titulo: "Te lo recordamos", texto: "48 h, 24 h y 3 h antes. Confirmás o reprogramás con un botón." },
];

export default function Inicio() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <span className="flex items-center gap-2 font-titulo text-lg font-semibold text-menta-800">
          <IconoDiente className="text-coral-700" width={24} height={24} />
          {sitio.marca}
          <span className="sr-only"> · Clínica dental</span>
        </span>
        <a
          href={enlaceWhatsapp()}
          className="inline-flex min-h-11 items-center rounded-full border border-menta-700 px-4 text-sm font-bold text-menta-700 hover:bg-menta-50"
        >
          WhatsApp
        </a>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-5xl gap-10 px-4 pb-16 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-14">
          <div className="flex flex-col gap-5">
            <p className="font-titulo text-sm font-semibold uppercase tracking-widest text-coral-700">Clínica Dental Confluencia · Neuquén</p>
            <h1 className="font-titulo text-4xl font-semibold leading-tight text-balance lg:text-5xl">Tu turno con el dentista, por WhatsApp y sin esperar.</h1>
            <p className="text-lg text-tinta-suave">
              Pedí, cambiá o cancelá tu turno a cualquier hora. Te lo recordamos antes y, si se libera un horario, se lo ofrecemos a quien estaba esperando.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={enlaceWhatsapp()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-menta-700 px-6 font-bold text-blanco hover:bg-menta-800"
              >
                <IconoChat />
                Escribinos por WhatsApp
              </a>
              <a href="#prestaciones" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-bold text-menta-700 underline-offset-4 hover:underline">
                Ver prestaciones y horarios
                <IconoFlecha />
              </a>
            </div>
          </div>

          <figure>
            <div className="ticket relative mx-auto max-w-sm rounded-ticket border border-linea bg-blanco p-6 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-wider text-tinta-suave">Tu turno</p>
              <p className="mt-2 font-titulo text-3xl font-semibold">Jueves 5/11 · 15:00</p>
              <div className="my-5 border-t-2 border-dashed border-linea" />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-tinta-suave">Prestación</dt>
                <dd className="font-bold">Limpieza dental</dd>
                <dt className="text-tinta-suave">Profesional</dt>
                <dd className="font-bold">Dra. Sofía Ibáñez</dd>
                <dt className="text-tinta-suave">Estado</dt>
                <dd>
                  <span className="inline-flex items-center gap-1 rounded-full bg-confirmado-fondo px-3 py-1 text-sm font-bold text-confirmado">
                    <IconoCheck width={16} height={16} />
                    Confirmado
                  </span>
                </dd>
              </dl>
            </div>
            <figcaption className="mt-3 text-center text-sm text-tinta-suave">Ejemplo de turno reservado por WhatsApp</figcaption>
          </figure>
        </section>

        <section aria-labelledby="como-funciona" className="bg-blanco py-16">
          <div className="mx-auto w-full max-w-5xl px-4">
            <h2 id="como-funciona" className="font-titulo text-2xl font-semibold lg:text-3xl">Así funciona</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {pasos.map(({ icono: Icono, titulo, texto }, i) => (
                <li key={titulo} className="flex flex-col gap-3 rounded-2xl bg-crema p-6">
                  <span className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-menta-50 text-menta-700">
                      <Icono />
                    </span>
                    <span className="font-titulo text-sm font-semibold text-coral-700">Paso {i + 1}</span>
                  </span>
                  <h3 className="font-titulo text-lg font-semibold">{titulo}</h3>
                  <p className="text-tinta-suave">{texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="prestaciones" aria-labelledby="titulo-prestaciones" className="mx-auto w-full max-w-5xl px-4 py-16">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 id="titulo-prestaciones" className="font-titulo text-2xl font-semibold lg:text-3xl">Prestaciones</h2>
              <p className="mt-2 text-tinta-suave">{clinica.precios.aclaracion}</p>
              <ul className="mt-6 divide-y divide-linea rounded-2xl border border-linea bg-blanco">
                {prestaciones.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <span>
                      <span className="block font-bold">{p.nombre}</span>
                      <span className="text-sm text-tinta-suave">{p.duracionMin} minutos</span>
                    </span>
                    <span className="font-titulo font-semibold tabular-nums">{pesos.format(p.precioArs)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl bg-menta-50 p-6">
                <h2 className="font-titulo text-xl font-semibold text-menta-800">Horarios</h2>
                <p className="mt-2">{sitio.horarios}</p>
              </div>
              <div className="rounded-2xl bg-blanco p-6 ring-1 ring-linea">
                <h2 className="font-titulo text-xl font-semibold">Obras sociales</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {clinica.obras_sociales.aceptadas.map((o) => (
                    <li key={o} className="flex items-center gap-2">
                      <IconoCheck className="text-confirmado" width={18} height={18} />
                      {o}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-tinta-suave">{clinica.obras_sociales.detalle}</p>
              </div>
              <div className="rounded-2xl bg-coral-50 p-6">
                <h2 className="font-titulo text-xl font-semibold text-coral-700">¿Dolor fuerte o urgencia?</h2>
                <p className="mt-2">Escribinos y te pasamos con recepción, o llamá a la guardia: {sitio.telefonoGuardia}.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-linea bg-blanco px-4 py-8 text-sm text-tinta-suave">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-bold text-tinta">Proyecto de demostración — marca ficticia</p>
            <p>{sitio.direccion}. WhatsApp: {sitio.whatsappVisible}.</p>
            <p>Desarrollado por Germán Schouabs.</p>
          </div>
          <Link href="/panel" className="inline-flex min-h-11 items-center self-start font-bold text-menta-700 underline underline-offset-4">
            Panel de recepción (demo)
          </Link>
        </div>
      </footer>
    </>
  );
}
