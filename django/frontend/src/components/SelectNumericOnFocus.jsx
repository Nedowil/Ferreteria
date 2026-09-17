import { useEffect } from "react";

// Mejora de usabilidad GLOBAL para cajeros que batallan con la compu: al hacer
// clic (o entrar con Tab) en cualquier campo numérico, se selecciona todo su
// contenido, de modo que basta con escribir el valor nuevo — ya no hay que
// posicionar el cursor detrás del número.
//
// Aplica a todos los <input type="number"> del sistema (cantidad, precio,
// descuento, monto recibido, etc.) y a cualquier campo marcado con
// data-selectall. Al ser global, los campos nuevos lo heredan solos.
//
// El requestAnimationFrame es clave: el clic primero coloca el cursor y recién
// después corre la selección, así no se "colapsa". Un segundo clic sí posiciona
// el cursor (por si quieren editar en medio del número).
export default function SelectNumericOnFocus() {
  useEffect(() => {
    const isNumeric = (el) =>
      el && el.tagName === "INPUT" && !el.readOnly && !el.disabled &&
      (el.type === "number" || el.dataset.selectall !== undefined);

    const onFocusIn = (e) => {
      const el = e.target;
      if (!isNumeric(el)) return;
      requestAnimationFrame(() => { try { el.select(); } catch { /* algunos navegadores no permiten select en number */ } });
    };

    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);
  return null;
}
