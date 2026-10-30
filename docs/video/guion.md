# Guion del video de TurnoListo (85 s)

Formato: pantalla grabada + voz en off de Germán. Vertical 9:16 para LinkedIn/Reels y horizontal 16:9 para Upwork/Workana
(misma voz, se reencuadra). Subtítulos siempre: mucha gente lo ve sin sonido.

| Tiempo | Imagen | Voz en off |
|---|---|---|
| 0:00–0:05 | Texto grande sobre fondo crema: "¿Cuántos turnos perdés por semana?" | "¿Cuántos turnos perdés por semana porque alguien no avisó?" |
| 0:05–0:15 | Agenda con huecos y un celular lleno de mensajes "¿tienen turno el jueves?" | "En una clínica, recepción contesta lo mismo todo el día, y cuando alguien cancela, el hueco queda vacío." |
| 0:15–0:32 | Celular: nota de voz "¿Tienen turno mañana a la mañana para una consulta?" → lista de horarios → elige → confirmación. Al lado, el evento en Google Calendar. | "Armé un asistente de WhatsApp para una clínica de demostración. Entiende audios, busca horarios libres de verdad y reserva. El turno aparece en el calendario de la clínica." |
| 0:32–0:44 | Recordatorio con botones "Confirmo / Reprogramar" → toca "Confirmo" → "¡Gracias! Quedó confirmado". | "48, 24 y 3 horas antes manda un recordatorio. Un toque y queda confirmado. Si cancela, le ofrece el lugar al primero de la lista de espera." |
| 0:44–0:54 | "Tengo un dolor muy fuerte y se me hinchó la cara" → respuesta con el teléfono de guardia → aparece en el panel como "Urgencia". | "Y lo importante no depende de la IA: ante una urgencia, o si alguien pide una persona, pasa directo a recepción." |
| 0:54–1:08 | Panel: KPIs (confirmación, cancelaciones recuperadas, derivaciones), "Marcar resuelta", agenda semanal; un turno pasa de "Reservado" a "Confirmado". | "Recepción ve todo en un panel: qué falta confirmar, qué conversaciones la esperan y la agenda de la semana." |
| 1:08–1:20 | Captura `05-resultados.png`: 16/16 conversaciones, Lighthouse 98/100/100/100, 2,2 s, USD 0,003. | "Está probado: dieciséis conversaciones reales de prueba, accesibilidad sin errores, responde en unos dos segundos y cuesta menos de un centavo de dólar por conversación." |
| 1:20–1:25 | Nombre, "Proyecto de demostración — datos ficticios" y link al repo. | "Si querés esto para tu clínica o tu negocio, escribime." |

## Cómo grabarlo
- **Celular:** con el webhook publicado (preview de Vercel o túnel) y tu número en `WHATSAPP_DESTINOS_PERMITIDOS`,
  escribirle al número de prueba de Meta desde tu WhatsApp. Grabar la pantalla del celular.
- **Sin publicar todavía:** usar `npm run simular -- audio` / `reservar` / `urgencia` y la captura
  `docs/capturas/04-conversacion-reserva.png`; aclarar en pantalla "conversación simulada con respuestas reales de Gemini".
- **Panel:** `npm run db:seed` antes de grabar, así los números y la cola arrancan iguales. Entrar con el usuario demo
  (`PANEL_DEMO_EMAIL` / `PANEL_DEMO_PASSWORD` de `.env.local`) y no mostrar la contraseña.
- No mostrar `.env.local`, tokens, el panel de Meta ni números de teléfono reales.
