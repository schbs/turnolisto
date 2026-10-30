# n8n: recordatorios

`recordatorios.json` llama cada 15 minutos a `GET /api/cron/recordatorios` con `Authorization: Bearer <CRON_SECRET>`.
El job es idempotente: si corre de más o dos veces a la vez, no manda nada repetido.

Antes de importarlo:
- Reemplazar `TU-DOMINIO` y `REEMPLAZAR_POR_CRON_SECRET` (el valor de `.env.local`; no se guarda en el repo).
- Mirar el cupo de ejecuciones del plan de n8n: cada 15 minutos son ~2.900 ejecuciones por mes. Cada hora son ~720
  (los recordatorios salen con hasta 1 h de atraso). En Vercel Hobby el cron corre una sola vez por día: no alcanza.

*English:* `recordatorios.json` calls the reminder job every 15 minutes. Replace the two placeholders before importing,
and check your n8n plan's execution quota (~2,900 runs a month at this interval).
