/* Integración con Zebra Browser Print.
 *
 * Zebra Browser Print es un programa GRATIS de Zebra que se instala en la
 * computadora y deja que una página web mande código nativo (ZPL) directo a una
 * Zebra conectada por USB. Así la impresora dibuja cada etiqueta ella misma —
 * nunca salen en blanco ni borrosas, sin depender del navegador.
 * Descarga: https://www.zebra.com → Soporte → Browser Print.
 *
 * El servicio local escucha en el loopback. Desde una página HTTPS hay que usar
 * el endpoint HTTPS (9101); si la app fuera HTTP, sirve el 9100.
 */

const BP_BASES = ["https://127.0.0.1:9101", "http://127.0.0.1:9100"];

async function jget(base, path, ms = 3000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(base + path, { signal: ctrl.signal });
    return r.ok ? await r.json().catch(() => ({})) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Busca el endpoint del servicio local que responde.
async function findBase() {
  for (const base of BP_BASES) {
    const avail = await jget(base, "/available");
    if (avail) return { base, avail };
  }
  return null;
}

// Elige la impresora: la predeterminada si existe, si no la primera disponible.
function pickDevice(avail, def) {
  if (def && (def.uid || def.name || def.connection)) return def;
  const list = (avail && (avail.printer || avail.device)) || [];
  return list[0] || def || null;
}

function bpError(code, message) {
  const e = new Error(message || code);
  e.code = code;
  return e;
}

/** Envía una cadena ZPL a la Zebra local vía Browser Print.
 *  Lanza un Error con .code = NO_BP | NO_PRINTER | WRITE si algo falla. */
export async function printZpl(zpl) {
  const found = await findBase();
  if (!found) throw bpError("NO_BP", "Zebra Browser Print no está disponible.");
  const { base, avail } = found;

  const def = await jget(base, "/default_device");
  const device = pickDevice(avail, def);
  if (!device) throw bpError("NO_PRINTER", "No se encontró una Zebra conectada.");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(base + "/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device, data: zpl }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw bpError("WRITE", "La Zebra no aceptó el trabajo de impresión.");
  } catch (e) {
    if (e.code) throw e;
    throw bpError("WRITE", "No se pudo enviar a la Zebra.");
  } finally {
    clearTimeout(t);
  }
}
