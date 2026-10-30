// Descarga de archivos (notas de voz) que llegan por WhatsApp: primero se pide la URL del media y después el archivo.

export async function descargarMedia(mediaId: string, token: string, version = "v25.0"): Promise<{ datos: ArrayBuffer; tipo: string }> {
  const info = await fetch(`https://graph.facebook.com/${version}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!info.ok) throw new Error(`No se pudo leer el media ${mediaId}: HTTP ${info.status}`);
  const { url, mime_type } = (await info.json()) as { url: string; mime_type: string };
  const archivo = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (!archivo.ok) throw new Error(`No se pudo descargar el media ${mediaId}: HTTP ${archivo.status}`);
  return { datos: await archivo.arrayBuffer(), tipo: mime_type };
}
