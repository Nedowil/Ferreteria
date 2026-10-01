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

// ── IP por COMPUTADORA ──────────────────────────────────────────────────────
// Cada PC puede tener su propia impresora. La IP se guarda en el navegador de
// esa computadora (localStorage) y, si está puesta, MANDA sobre la IP global de
// la empresa. Si no hay nada guardado, se usa la global. Útil cuando cada caja
// tiene su propia impresora en red.
const LS_KEY = "epos_printer";

export function getLocalEpos() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && o.ip ? { ip: o.ip, protocol: o.protocol || "https" } : null;
  } catch { return null; }
}

export function setLocalEpos(ip, protocol) {
  try {
    const clean = (ip || "").trim();
    if (clean) localStorage.setItem(LS_KEY, JSON.stringify({ ip: clean, protocol: protocol || "https" }));
    else localStorage.removeItem(LS_KEY);
  } catch { /* almacenamiento no disponible: se ignora */ }
}

export function eposUrlFor(ip, protocol) {
  return `${protocol || "https"}://${ip}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
}

// Si ESTA computadora tiene impresora propia configurada, usa esa URL; si no,
// usa la que armó el servidor (la global de la empresa).
export function resolveEposUrl(serverUrl) {
  const local = getLocalEpos();
  return local ? eposUrlFor(local.ip, local.protocol) : serverUrl;
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
