import { useEffect } from "react";

// Mejora de usabilidad GLOBAL para cajeros que batallan con la compu: al hacer
// clic (o entrar con Tab) en cualquier campo numérico, el CURSOR (la barrita)
// se coloca AL FINAL del número — listo para editar (borrar el último dígito o
// seguir escribiendo) sin tener que posicionarlo a mano. NO se resalta/selecciona.
//
// Aplica a todos los <input type="number"> del sistema (cantidad, precio,
// descuento, monto recibido, etc.). Al ser global, los campos nuevos lo heredan.
//
// Detalle: en type="number" el navegador no permite setSelectionRange, así que
// el cursor se lleva al final re-asignando el valor (vaciar y restaurar), que sí
// funciona ahí. El requestAnimationFrame es clave: corre DESPUÉS de que el clic
// posicionó el cursor, para ganarle y dejarlo al final.
export default function NumericCaretOnFocus() {
  useEffect(() => {
    const isNumeric = (el) =>
      el && el.tagName === "INPUT" && !el.readOnly && !el.disabled &&
      (el.type === "number" || el.dataset.caretend !== undefined);

    const caretToEnd = (el) => {
      try {
        if (el.type === "number") {
          const v = el.value;
          el.value = "";      // re-asignar el valor reposiciona el cursor al final
          el.value = v;
        } else {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      } catch { /* algún navegador no permite manipular la selección aquí */ }
    };

    const onFocusIn = (e) => {
      const el = e.target;
      if (!isNumeric(el)) return;
      requestAnimationFrame(() => caretToEnd(el));
    };

    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);
  return null;
}
