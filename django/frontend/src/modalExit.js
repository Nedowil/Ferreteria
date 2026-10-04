// Animación de SALIDA de los modales — global, sin tocar cada componente.
//
// Problema: React quita el modal del DOM al instante al cerrarse, así que no da
// tiempo de animar la salida. Truco: observamos el DOM; cuando React quita un
// overlay de modal, lo volvemos a insertar como COPIA inerte (sin listeners de
// React), le reproducimos la animación de salida y, al terminar, lo quitamos.
//
// Solo aplica a overlays centrados (mismo patrón que la entrada: inset-0 +
// justify-center + items-*). Excluye los que tengan la clase `no-anim`
// (p. ej. el modal de medida del POS). Respeta "reducir movimiento".

const reduce = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false };

function isModalOverlay(el) {
  if (!el || el.nodeType !== 1 || !el.classList) return false;
  const c = el.classList;
  return (
    c.contains("fixed") && c.contains("inset-0") && c.contains("justify-center") &&
    (c.contains("items-center") || c.contains("items-start") || c.contains("items-end")) &&
    !c.contains("no-anim") &&
    !el.hasAttribute("data-exiting")
  );
}

function playExit(node) {
  try {
    const sheet = node.firstElementChild;
    node.setAttribute("data-exiting", "");
    node.style.pointerEvents = "none";
    // Fijar la animación de salida ANTES de reinsertar, para que al re-agregar
    // el nodo no vuelva a correr la animación de ENTRADA del CSS.
    node.style.animation = "overlayOut .16s ease-in both";
    if (sheet) sheet.style.animation = "sheetOut .16s cubic-bezier(0.77, 0, 0.175, 1) both";
    document.body.appendChild(node);

    let removed = false;
    const done = () => {
      if (removed) return;
      removed = true;
      if (node.parentNode) node.parentNode.removeChild(node);
    };
    node.addEventListener("animationend", done, { once: true });
    setTimeout(done, 400); // respaldo por si no dispara animationend
  } catch {
    try { if (node.parentNode) node.parentNode.removeChild(node); } catch { /* nada */ }
  }
}

export function installModalExit() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  const obs = new MutationObserver((mutations) => {
    if (reduce.matches) return;
    for (const m of mutations) {
      for (const node of m.removedNodes) {
        if (isModalOverlay(node)) playExit(node);
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}
