// Envío de un ticket a una impresora Epson por ePOS-Print (modo "epos").
//
// La PC de la tienda hace un POST directo al mini-servidor web de la impresora
// en la red local. NO pasa por la nube ni por la cola de impresión de Windows.
//
// Devuelve { ok, code, error }:
//   - ok:true             imprimió bien
//   - ok:false, code      la impresora respondió un error (sin papel, tapa, etc.)
//   - ok:false, error     no se pudo conectar (red, IP, mixed-content, certificado)
export async function sendEposPrint(url, xml) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": '""' },
      body: xml,
    });
  } catch (e) {
    // Falla de red / mixed-content / certificado no aceptado.
    return { ok: false, error: e?.message || "sin conexión" };
  }
  let text = "";
  try { text = await res.text(); } catch { /* respuesta vacía */ }
  if (/success="true"/i.test(text)) return { ok: true };
  const code = (text.match(/code="([^"]*)"/i) || [])[1] || "";
  // Si la impresora respondió pero sin success ni code legible, igual es un fallo.
  return { ok: false, code: code || (res.ok ? "" : String(res.status)) };
}

// Mensaje de ayuda cuando NO se pudo conectar con la impresora ePOS.
export const EPOS_HELP =
  "No se pudo conectar con la impresora por la red local. Verificá: " +
  "1) que la PC y la impresora estén en la misma red; " +
  "2) que la IP configurada sea la correcta; " +
  "3) que hayas abierto una vez https://IP-de-la-impresora en el navegador y aceptado el certificado de seguridad.";

// Traduce el código de error de la impresora a algo entendible.
export function eposCodeMessage(code) {
  const M = {
    EPTR_COVER_OPEN: "la tapa de la impresora está abierta.",
    EPTR_REC_EMPTY: "no hay papel.",
    EPTR_AUTOMATICAL: "error mecánico de la impresora.",
    EPTR_UNRECOVERABLE: "error de la impresora (reiniciala).",
    DeviceNotFound: "la impresora no respondió (revisá la IP/red).",
    Timeout: "la impresora no respondió a tiempo.",
  };
  if (!code) return "la impresora respondió un error. Revisá papel y tapa.";
  return M[code] || `la impresora respondió un error (${code}). Revisá papel y tapa.`;
}
