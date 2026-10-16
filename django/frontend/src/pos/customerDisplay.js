// Sincroniza el estado del POS con la "Pantalla de cliente" (ventana/monitor
// secundario) usando BroadcastChannel, con respaldo en localStorage para que
// una ventana abierta después tome el estado actual y para navegadores sin
// soporte de BroadcastChannel (evento `storage`).

const CHANNEL = "ferreteria-customer-display";
const STORAGE_KEY = "fz_customer_display";

let pubChannel = null;
function channel() {
  if (pubChannel === null && typeof BroadcastChannel !== "undefined") {
    pubChannel = new BroadcastChannel(CHANNEL);
  }
  return pubChannel;
}

// Publica el estado actual (lo llama el POS).
export function publishDisplay(state) {
  const payload = { ...state, t: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) { /* almacenamiento no disponible */ }
  const c = channel();
  if (c) c.postMessage(payload);
}

// Suscribe la pantalla de cliente. Devuelve una función para desuscribir.
export function subscribeDisplay(onState) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) onState(JSON.parse(raw));
  } catch (_) { /* ignore */ }

  let bc = null;
  if (typeof BroadcastChannel !== "undefined") {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (e) => onState(e.data);
  }
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try { onState(JSON.parse(e.newValue)); } catch (_) { /* ignore */ }
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    if (bc) bc.close();
    window.removeEventListener("storage", onStorage);
  };
}

// Abre (o enfoca) la ventana de la pantalla de cliente.
export function openCustomerDisplay() {
  window.open("/pantalla-cliente", "pantalla-cliente",
    "width=900,height=700,menubar=no,toolbar=no,location=no");
}
