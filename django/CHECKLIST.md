# ✅ Checklist — Ferretería Central

Marcá cada punto a medida que lo completás. Dividido en: pruebas FEL reales
(las que solo podés hacer vos con internet + Infile), y puesta en producción.

---

## 1) Pruebas FEL reales (contra Infile) — en tu máquina, con internet

> Requisito: en el `.env` tener `FEL_DRIVER=infile` y tus credenciales de
> Infile cargadas. La empresa (Administración → Empresa) con el **NIT emisor**
> correcto. Recordá: en PRUEBAS la serie sale como **PRUEBAS** y la fecha debe
> estar dentro de los **últimos 5 días**.

- [ ] **1.1 Factura normal (contado)** — Vendé de contado, marcá "📑 Factura FEL",
      cobrá. Debe quedar **certificada** con su autorización (UUID) en el módulo
      de Facturación.
- [ ] **1.2 Factura con NIT del cliente** — Igual que arriba pero con un cliente
      que tenga NIT. Verificá que la factura salga a ese NIT.
- [ ] **1.3 Factura con DPI/CUI** — Cliente con DPI (13 dígitos). Debe certificar
      marcando el receptor como CUI.
- [ ] **1.4 Factura con descuento** — Aplicá un descuento y facturá. El total y
      el IVA deben cuadrar y certificar.
- [ ] **1.5 Producto EXENTO de IVA** — Facturá un producto marcado como exento.
      Debe salir sin línea de IVA y certificar. *(avisame si SAT lo rechaza)*
- [ ] **1.6 Factura Cambiaria (venta al crédito)** — Marcá "Venta al crédito" +
      "📑 Factura FEL". Debe emitirse como **Factura Cambiaria (FCAM)** con el
      abono/vencimiento. *(es la función nueva; confirmá que Infile la acepte)*
- [ ] **1.7 Nota de Crédito (desde una devolución)** — Hacé una devolución de una
      venta **ya facturada** y emití la **Nota de Crédito (FEL)**. Debe referenciar
      la factura original y certificar.
- [ ] **1.8 Anulación de factura** — Anulá una factura certificada (con motivo).
      Debe quedar como **anulada**.
- [ ] **1.9 FEL diferida OFFLINE** — Desconectá el internet un momento, vendé con
      "📑 Factura FEL" (queda OFFLINE con comprobante provisional), reconectá y
      verificá que la venta se sincronice **y la factura se certifique sola**.

> Si algo **no certifica**: copiá el mensaje de error exacto que muestra la app
> y pasámelo. Casi siempre es la fecha (>5 días), el NIT emisor, o un dato del
> receptor — se corrige rápido.

---

## 2) Modo offline — prueba en condiciones reales

- [ ] **2.1** Abrí la app compilada (`npm run build`) servida por Django, o ya en
      el hosting con HTTPS. (El modo offline **no** funciona en `npm run dev`.)
- [ ] **2.2** Abrí caja **estando en línea** (al inicio del día).
- [ ] **2.3** Cortá el internet: debe aparecer el banner **● OFFLINE** y dejarte
      seguir vendiendo. Cada venta imprime **comprobante provisional**.
- [ ] **2.4** Reconectá: las ventas pendientes deben **subir solas** (contador a 0)
      y descontar stock / registrar caja.
- [ ] **2.5** Verificá en "Ventas" que quedaron todas las ventas hechas offline.

---

## 3) Puesta en producción (hosting)

- [ ] **3.1** Elegir hosting (Render, VPS, etc.).
- [ ] **3.2** Base de datos **PostgreSQL** (no SQLite) para producción.
- [ ] **3.3** Dominio propio + **HTTPS** (obligatorio para el modo offline/PWA).
- [ ] **3.4** Variables de entorno de producción: `DEBUG=0`, `ALLOWED_HOSTS`,
      `SECRET_KEY` nueva, `DATABASE_URL`.
- [ ] **3.5** Credenciales FEL de **PRODUCCIÓN** (cuando SAT te habilite) y
      `FEL_ENVIRONMENT=PRODUCCION`.
- [ ] **3.6** Respaldos automáticos activados (módulo Respaldos / S3 opcional).
- [ ] **3.7** Crear los usuarios reales y asignarles rol + sucursal.
- [ ] **3.8** Cargar los datos de la empresa (NIT, dirección, régimen) y el
      logo definitivo.

---

## 4) Datos iniciales de operación

- [ ] **4.1** Cargar el inventario real (productos, precios, empaques, stock).
- [ ] **4.2** Cargar proveedores y clientes frecuentes.
- [ ] **4.3** Configurar sucursales y asignar usuarios a cada una.
- [ ] **4.4** Definir roles/permisos de cada empleado (vendedor, almacenista…).
- [ ] **4.5** Configurar la impresora (ticket térmico / etiquetas Zebra) si aplica.

---

_Cualquier punto que se trabe, anotá el error y lo resolvemos._
