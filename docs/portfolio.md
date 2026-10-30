# TurnoListo: caso para el portfolio

> Proyecto de demostración: clínica ficticia y datos inventados. Desarrollado por Germán Schouabs.

## Problema
Una clínica odontológica pierde turnos por cancelaciones de último momento y ausencias, y recepción pasa el día
contestando las mismas preguntas por WhatsApp. Los huecos que se liberan quedan vacíos.

## Solución
Un agente de WhatsApp que da, cambia y cancela turnos contra la agenda real, entiende notas de voz, manda recordatorios
a 48 h, 24 h y 3 h con botones, ofrece los huecos a la lista de espera y deriva a una persona ante urgencias o pedidos.
Recepción ve todo en un panel: confirmaciones, derivaciones y agenda semanal.

## Skills
Agentes de IA con herramientas (function calling, salidas validadas) · WhatsApp Cloud API (webhooks firmados, botones,
listas, plantillas) · Next.js 16 + TypeScript · Supabase (Postgres, RLS, Auth) · Google Calendar API · Whisper ·
testing de agentes con conversaciones grabadas · Playwright, axe y Lighthouse.

## Métricas medidas (30/10/2026)
- **16/16 conversaciones de negocio** en verde (y 14/14 corridas en vivo contra Gemini).
- **Lighthouse móvil 98/100/100/100** en la landing y en el panel; **0 violaciones de accesibilidad** (axe, WCAG 2.1 AA).
- **Latencia mediana del agente: 2,2 s por mensaje** (21 mensajes, 2,05 llamadas al modelo por mensaje).
- **Costo estimado: USD 0,003 por conversación** con Gemini 3.5 Flash-Lite en plan pago.
- **11/11 e2e** (celular y compu) y **97/97 tests** de unidad, dominio y conversación.

## Lo que encontraron las pruebas con IA real (y se corrigió)
- Un paciente que ya había reservado dijo "confirmámelo" y el modelo le reservó **otro turno a la misma hora** con otra
  profesional. Se agregó una regla de dominio: un paciente no puede tener turnos superpuestos.
- El recorte a 3 oraciones cortaba en "Dra.": ahora respeta abreviaturas y números.
- El plan gratis de Gemini 3.5 Flash da solo 20 pedidos por día: se pasó a Flash-Lite y el bot responde y deriva si se queda sin cupo.
