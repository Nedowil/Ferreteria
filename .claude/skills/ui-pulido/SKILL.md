---
name: ui-pulido
description: >-
  Reglas de pulido de interfaz y animaciones para el frontend de Ferretería
  (React + Vite + Tailwind). Úsala al crear o modificar pantallas, botones,
  modales, listas, tarjetas o cualquier animación/transición. Adaptada de las
  skills de Emil Kowalski (emilkowalski/skills) al stack y convenciones de este
  proyecto. Objetivo: que la UI se sienta rápida, consistente y bien hecha, y
  que funcione bien en celular.
---

# Pulido de UI y animaciones — Ferretería

Guía para que todo lo nuevo se sienta cuidado. No es decoración: cada detalle
suma. Aplicar SIEMPRE que se toque UI. Stack: React 18 + Vite + Tailwind.

## 1. ¿Debe animar? (decidir antes de codear)

| Frecuencia de la acción | Animación |
|---|---|
| Cientos de veces/día (teclas, escanear, cobrar en POS) | **Ninguna** |
| Decenas de veces/día | Casi imperceptible (≤120ms) |
| Ocasional (modales, toasts, abrir fila) | Estándar |
| Rara / primera vez | Puede tener un toque de gracia |

- **Nunca** animar acciones del POS que se repiten todo el día (agregar al
  carrito, escanear, Enter). Que se sientan instantáneas.
- Toda animación necesita un **propósito**: feedback, consistencia espacial,
  indicar estado, evitar un cambio brusco o explicar algo. "Se ve cool" no basta.

## 2. Easing y duración

- **Nunca** `transition: all` → especificar la propiedad: `transition-transform`,
  `transition-colors`, `transition-opacity`.
- **Nunca** `ease-in` en UI (se siente lento). Usar:
  - Entrar/salir → `ease-out`  (fuerte: `cubic-bezier(0.23, 1, 0.32, 1)`)
  - Movimiento en pantalla → `ease-in-out` (`cubic-bezier(0.77, 0, 0.175, 1)`)
  - Hover/color → `ease`
  - Movimiento constante (spinner) → `linear`
- **Duración (UI por debajo de 300ms):**
  - Botón: 100–160ms · Tooltip/popover: 125–200ms · Dropdown: 150–250ms ·
    Modal/drawer: 200–500ms
- **Salida más rápida que la entrada.** Lento donde el usuario decide, rápido
  donde responde el sistema.

En Tailwind: `transition-transform duration-150 ease-out`. Para curvas custom,
`style={{ transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }}` o una
clase en `index.css`.

## 3. Botones (feedback al tocar)

Todo botón importante debe "hundirse" al presionar:

```jsx
className="... transition-transform duration-150 ease-out active:scale-[0.97]"
```

En táctil da sensación de respuesta inmediata. No agrega latencia real.

## 4. Propiedades que se animan

- **Solo `transform` y `opacity`** (van por GPU, no recalculan layout/paint).
  Evitar animar `width`, `height`, `top`, `left`, `margin`.
- **Nunca** desde `scale(0)` → usar `scale(0.95)` + `opacity: 0` (nada
  desaparece del todo en la realidad).
- Modales: entran con `scale(0.97) + opacity:0` → `scale(1)`. `transform-origin:
  center` (están centrados). Popovers/menus: origen en el disparador, no al centro.

Entrada con CSS puro cuando se pueda (`@starting-style`), o con la clase que ya
exista. Para listas, **stagger** de 30–80ms entre ítems (sin bloquear la
interacción).

## 5. Accesibilidad y táctil (OBLIGATORIO)

- **Reduced motion**: respetar `prefers-reduced-motion`. Quitar movimiento/posición,
  dejar opacidad/color.
  ```css
  @media (prefers-reduced-motion: reduce) { * { animation-duration: .01ms; transition-duration: .01ms; } }
  ```
  (o por componente). Tailwind: usar la variante `motion-reduce:`.
- **Hover solo en no-táctil**: en celular el hover "se pega". Gatear efectos de
  hover con `@media (hover:hover) and (pointer:fine)` → en Tailwind, variante
  `[@media(hover:hover)]:hover:...` o mantener el hover solo en estilos sutiles.
- Foco visible siempre (`focus:ring-2`), y objetivos táctiles cómodos (~40px).

## 6. Convenciones ya establecidas en este proyecto (mantenerlas)

- **Responsive**: las tablas anchas van en `overflow-x-auto` DENTRO de su tarjeta;
  en celular se prefieren **tarjetas** (`hidden md:block` tabla / `md:hidden`
  tarjetas), como en ProductList, CashSessions y StockCountHistory. Nada debe
  desbordar la pantalla horizontalmente (usar `overflow-x-clip`, `min-w-0`,
  `break-words`, `flex-wrap`).
- **Montos/KPIs**: `tabular-nums` y `break-words` (montos grandes no se salen).
- **Dark mode**: ya se maneja con clases `dark:`; no romperlo. Dar color de fondo
  explícito a contenedores nuevos.
- **Modales**: overlay `fixed inset-0 z-50 bg-black/50`, cierre al tocar afuera
  (`onClick` en overlay + `stopPropagation` en la tarjeta) y con `Esc` cuando
  aplique. En celular, hoja desde abajo (`items-end sm:items-center`,
  `rounded-t-2xl sm:rounded-2xl`) como el modal de movimientos de caja.
- **Color por módulo**: encabezados de sección con acento + `border-l-4` y header
  tintado (como CompanySettings / Historial de inventarios). Chips de estado con
  color semántico (verde/ámbar/rojo), separado del color de acento.
- **Escaneo**: leer `e.target.value` en el handler de Enter (no el estado de
  React), con debounce + contador de secuencia para ignorar respuestas viejas
  (como ReturnCreate/StockCount).

## 7. Checklist de revisión (antes de dar por hecho)

| Problema | Arreglo |
|---|---|
| `transition: all` / `transition-all` | Especificar la propiedad |
| Entrada desde `scale(0)` | `scale(0.95)` + `opacity:0` |
| `ease-in` en UI | `ease-out` o curva custom |
| Animar `width/height/top/left` | Animar `transform` |
| Duración > 300ms sin razón | Bajar a 150–250ms |
| Hover sin gatear en táctil | Gatear con `hover:hover` |
| Sin `prefers-reduced-motion` | Agregar variante reduce |
| Animar acción repetida del POS | Quitar la animación |
| Entrada y salida a la misma velocidad | Salida más rápida |
| Tabla que desborda en celular | `overflow-x-auto` o tarjetas `md:hidden` |

Regla de oro: **revisar con ojos frescos** (ralentizar la animación 2–5x o verla
al día siguiente) para cazar detalles de timing que no se notan a velocidad real.
