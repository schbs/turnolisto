// Íconos de trazo (estilo Lucide, dibujados a mano para no sumar dependencias). Decorativos: aria-hidden.
import type { SVGProps } from "react";

function Icono({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const IconoChat = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 20.5l1.6-5.4A8.4 8.4 0 1 1 21 11.5Z" />
  </Icono>
);
export const IconoReloj = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icono>
);
export const IconoCheck = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icono>
);
export const IconoCruz = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icono>
);
export const IconoAlerta = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </Icono>
);
export const IconoCalendario = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icono>
);
export const IconoCampana = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icono>
);
export const IconoPersona = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </Icono>
);
export const IconoDiente = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M12 5.5C10.5 4 8.5 3.5 7 4c-2.5.8-3.3 3.6-2.6 6.3.6 2.3 1.4 3.6 1.8 6.2.4 2.4.9 4 2 4 1.5 0 1.5-4.5 3.8-4.5s2.3 4.5 3.8 4.5c1.1 0 1.6-1.6 2-4 .4-2.6 1.2-3.9 1.8-6.2.7-2.7-.1-5.5-2.6-6.3-1.5-.5-3.5 0-5 1.5Z" />
  </Icono>
);
export const IconoFlecha = (p: SVGProps<SVGSVGElement>) => (
  <Icono {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icono>
);
