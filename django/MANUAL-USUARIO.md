# Manual de Usuario — Ferretería Central

Sistema de gestión para ferretería: punto de venta, inventario, caja,
facturación electrónica (FEL Guatemala), compras, cotizaciones, devoluciones y
reportes.

> Este manual está escrito para el personal que usa el sistema (administrador,
> vendedor, bodeguero). No hace falta saber de computación: se explica paso a
> paso.

---

## Índice

1. [Ingresar al sistema (login)](#1-ingresar-al-sistema)
2. [La pantalla principal (Tablero)](#2-la-pantalla-principal-tablero)
3. [Caja](#3-caja)
4. [Punto de Venta (POS)](#4-punto-de-venta-pos)
5. [Ventas y cuentas por cobrar](#5-ventas-y-cuentas-por-cobrar)
6. [Devoluciones](#6-devoluciones)
7. [Cotizaciones](#7-cotizaciones)
8. [Facturación Electrónica (FEL)](#8-facturación-electrónica-fel)
9. [Inventario y Productos](#9-inventario-y-productos)
10. [Conteo físico](#10-conteo-físico)
11. [Compras y Proveedores](#11-compras-y-proveedores)
12. [Facturas de proveedor y Fondo](#12-facturas-de-proveedor-y-fondo)
13. [Reportes](#13-reportes)
14. [Administración](#14-administración)
15. [Preguntas frecuentes](#15-preguntas-frecuentes)

---

## 1. Ingresar al sistema

1. Abrí el sistema en el navegador (Chrome, Edge, etc.).
2. Escribí tu **correo** y **contraseña**.
3. Tocá **Entrar**.

Si olvidaste la contraseña, pedile al administrador que te la reinicie desde
**Administración → Usuarios**.

**El menú de la izquierda** muestra solo los módulos a los que tenés permiso. En
**celular** el menú se abre con el botón **☰** de arriba.

**Cambiar de sucursal:** arriba a la derecha hay un selector de sucursal (ej.
*Casa Matriz*). Lo que veas y hagas aplica a la sucursal seleccionada.

---

## 2. La pantalla principal (Tablero)

Al entrar ves el **Tablero (Dashboard)** con un resumen: ventas de hoy, ventas
del mes, productos, stock bajo, cajas abiertas, etc. Cada usuario ve solo los
recuadros permitidos por su rol.

---

## 3. Caja

La caja controla el efectivo de una sucursal. **Todos los usuarios de la misma
sucursal comparten la misma caja.**

### Abrir caja
1. Entrá a **Caja**.
2. Tocá **Abrir caja**.
3. Escribí el **monto inicial** (el efectivo con el que arranca el día).
4. Confirmá. La caja queda **abierta** para toda la sucursal.

> Normalmente el **administrador** abre la caja al inicio del día. Una vez
> abierta, los vendedores de esa sucursal ya pueden cobrar.

### Movimientos de caja
Podés registrar entradas o salidas de efectivo que no son ventas (ej. pago de
un servicio, retiro). Quedan registrados con **quién** los hizo.

### Cerrar caja
1. Al final del día, tocá **Cerrar caja**.
2. Contá el efectivo físico y escribilo en **efectivo contado**.
3. El sistema muestra la **diferencia** (si sobra o falta).
4. Confirmá. Queda el corte guardado.

---

## 4. Punto de Venta (POS)

Es la pantalla para **cobrar**.

### Hacer una venta
1. Entrá a **Punto de venta**. (Debe haber una **caja abierta**.)
2. **Buscá el producto** por nombre, código o SKU, o escaneá el código de
   barras. Tocalo para agregarlo al carrito.
3. Ajustá la **cantidad** de cada producto.
4. (Opcional) Elegí un **cliente**. Si es nuevo, tocá **➕** para crearlo en el
   momento (podés traer sus datos de la SAT con el botón **🔍 SAT**).
5. (Opcional) Aplicá un **descuento**.
6. Elegí la **forma de pago** (Efectivo, Tarjeta, Transferencia) o marcá **Al
   crédito**.
7. Si el cliente quiere **factura electrónica**, activá **Factura FEL**.
8. Tocá **Cobrar**. Escribí el efectivo recibido; el sistema calcula el
   **vuelto**.
9. Se abre una ventana con el resultado. Desde ahí podés **🖨️ Ticket** o **🧾
   Ver venta**.

### Reglas importantes
- **No podés vender más de lo que hay en existencia** (te avisa con un mensaje).
- Si la factura FEL supera **Q2,500** y va a *Consumidor Final*, el sistema pide
  el **NIT o CUI** del cliente (regla de la SAT).

### Enviar el comprobante por WhatsApp
En la pantalla del ticket (botón **🖨️ Ticket** después de cobrar, o **Ver /
imprimir comprobante** desde Ventas) hay un botón **💬 WhatsApp** que arma un
resumen y lo envía. Si el cliente tiene teléfono registrado, abre su chat
directo.

### Modo sin internet (offline)
Si se va el internet, el POS **sigue funcionando**: las ventas se guardan en el
equipo y se **sincronizan** solas cuando vuelve la conexión (la factura FEL se
emite en ese momento).

---

## 5. Ventas y cuentas por cobrar

- **Ventas:** lista de todas las ventas. Podés abrir cada una, ver el detalle,
  **imprimir el comprobante**, o **emitir la factura FEL** si aún no la tiene.
- **Abonos:** si una venta fue al crédito, entrás a la venta y registrás los
  **abonos** hasta saldarla.
- **Cuentas por cobrar:** muestra el saldo pendiente de los clientes. Se puede
  filtrar por fecha y exportar a **Excel**.

---

## 6. Devoluciones

Para cuando un cliente **regresa un producto**.

### Formas de hacer una devolución
- **Por ticket (folio):** buscás la venta por su número y elegís qué devolver.
- **Por producto:** buscás el producto y el sistema muestra en qué ventas se
  vendió.
- **Sin ticket:** el cliente no trae comprobante; escribís el producto, la
  cantidad y el precio a mano.

### Pasos (por ticket)
1. Entrá a **Devoluciones → Nueva devolución → Por ticket**.
2. Buscá la venta por su folio (ej. `V-000001`).
3. En **A devolver**, escribí **cuántas unidades** regresa el cliente (es
   cantidad, no dinero). No te deja poner más de lo comprado.
4. Elegí el **motivo** y la **forma de reembolso** (Efectivo, Tarjeta,
   Transferencia, Nota de crédito).
5. Tocá **Procesar devolución**. El sistema reembolsa **lo que el cliente
   realmente pagó** (con descuento incluido) y **regresa el producto al stock**.

### Comprobante / Nota de Crédito
- Si la venta tenía **factura electrónica**, en el detalle de la devolución podés
  **Emitir nota de crédito (FEL)** — es el documento fiscal que revierte la
  factura.
- El botón **🖨️ Imprimir comprobante** genera la hoja para darle al cliente (o
  guardarla como PDF).

---

## 7. Cotizaciones

Para dar un **presupuesto** sin que sea una venta todavía.

1. Entrá a **Cotizaciones → Nueva cotización**.
2. Elegí (o creá con **➕**) el **cliente**.
3. Agregá los **productos** y cantidades.
4. Tocá **Guardar cotización**.
5. En el detalle podés: **🖨️ Imprimir / Guardar PDF**, **💬 Enviar por
   WhatsApp**, o **Convertir en venta** (descuenta stock y registra en caja).

El PDF de la cotización sale con formato profesional (emisor, receptor,
partidas, total en letras).

---

## 8. Facturación Electrónica (FEL)

Emisión de facturas electrónicas ante la SAT (a través del certificador Infile).

- **Emitir factura:** se puede desde el POS (activando *Factura FEL*) o después
  desde **Facturación → Ventas sin facturar → Facturar**.
- **Anular factura:** en **Facturación**, botón **Anular** (pide motivo).
- **Exportar a Excel:** el botón **⬇️ Excel** descarga el listado con las mismas
  columnas del reporte de DTE de la SAT.

En el ticket sale el **Número de Autorización**, la **serie/número** y el
**certificador**.

> **Ambiente:** mientras se prueba, la serie sale como `**PRUEBAS**` (sin validez
> fiscal). En producción sale una serie real.

---

## 9. Inventario y Productos

### Registrar un producto
1. Entrá a **Productos → + Nuevo producto**.
2. Completá **Nombre** (el SKU y el código de barras se generan solos si los
   dejás vacíos).
3. **Unidad y empaque:**
   - **Unidad base:** la más pequeña en que medís el producto (ej. *libra*,
     *metro*, *unidad*).
   - **Empaque** y **Factor:** si vendés por caja/rollo (ej. *1 caja = 50
     libras*), poné *caja* y *50*.
4. **Precios:** precio de compra y de venta (podés manejar precio por empaque y
   precio mayorista).
5. **Inventario:** stock inicial y **stock mínimo**.
   - El **stock mínimo** se puede escribir en unidad base o en empaque, y muestra
     la equivalencia (ej. *= 2 rollos*).
6. Guardá.

### Stock bajo
En **Stock bajo** ves los productos cuya existencia llegó al mínimo o menos, para
reponer.

### Cómo se controla el inventario
- El stock se guarda en **unidad base** y se muestra mixto (ej. *9 cajas + 49
  libras*).
- Cada cambio queda en un **historial de movimientos** (entrada, salida,
  ajuste), con quién, cuándo y por qué.
- **Vender** descuenta; **comprar** suma; **devolver** regresa; **transferir**
  mueve entre sucursales; **conteo físico** ajusta.

---

## 10. Conteo físico

Para cuadrar el sistema con lo que hay **físicamente** en bodega.

1. Entrá a **Conteo físico**.
2. Elegí el **modo**:
   - **Fijar existencia (recuento total):** dejás la existencia en el número que
     contaste (para un recuento completo).
   - **Sumar lo encontrado:** lo que escribís **se agrega** a lo que ya había
     (no borra lo registrado).
3. Buscá el producto y escribí la cantidad. Podés elegir contar en **unidad
   base** o en **empaque** (ej. cajas); el sistema convierte solo.
4. La columna **Resultado** te muestra en cuánto va a quedar **antes** de
   aplicar.
5. Tocá **Aplicar conteo**.

> Ejemplo: tenés 500 libras (10 cajas) de clavos y encontrás 6½ cajas más.
> Modo **Sumar**, escribís `6.5` en **caja** → Resultado **825 libras**, sin
> borrar las 10 cajas.

---

## 11. Compras y Proveedores

- **Proveedores:** catálogo de tus proveedores (nombre, NIT, contacto).
- **Compras:** registrás las órdenes de compra; al **recibir** la compra, el
  stock **sube** automáticamente.
- **Cuentas por pagar:** saldo pendiente con proveedores; se puede filtrar por
  fecha y exportar a Excel.

---

## 12. Facturas de proveedor y Fondo

Módulo simple para llevar el control de las **facturas que le pagás a tus
proveedores**, con una **caja/fondo** de efectivo.

### El fondo de proveedores
1. El administrador tocá **Abrir fondo** y pone el monto que deja para pagar
   (ej. Q5,000).
2. Cada factura pagada en **efectivo** **descuenta** del fondo; el **saldo
   disponible** se ve arriba.
3. **+ Agregar fondos** para poner más dinero; **Cerrar fondo** al terminar.

> Los pagos con **cheque, transferencia o tarjeta** se registran pero **no** tocan
> el fondo de efectivo.

### Registrar una factura pagada
1. Escribí el **proveedor**, **N° de factura**, **total**, **fecha** y **forma de
   pago**.
2. Tocá **Registrar**.

### Permisos
- **Registrar/editar facturas** y **Gestionar el fondo (abrir/cerrar/agregar)**
  son permisos **separados**: el administrador decide, por rol, quién puede hacer
  cada cosa (en **Administración → Roles**).

---

## 13. Reportes

En **Reportes** hay varios:
- **Ventas por periodo**, **Utilidad bruta**, **Top productos/clientes/
  proveedores**, **Ventas por vendedor** (con filtro por vendedor), **Ventas por
  categoría**, **Stock muerto**, **Corte diario de caja**, **Valor de
  inventario**.
- **Pagos a proveedores:** cuánto se pagó en efectivo por **día / mes / año**,
  desglose por forma de pago, **filtro por rango de fechas** e **historial de
  fondos** abiertos/cerrados.

Casi todos los reportes se pueden **exportar a Excel**.

---

## 14. Administración

Solo para usuarios con permisos de administración.

- **Usuarios:** crear usuarios, asignarles rol y sucursal, reiniciar contraseña.
- **Roles:** definir qué puede hacer cada rol marcando/desmarcando permisos.
- **Sucursales:** crear y gestionar sucursales.
- **Transferencias:** mover stock entre sucursales.
- **Auditoría:** ver quién creó, editó o eliminó cada cosa.
- **Empresa:** datos fiscales, IVA, impresora térmica, frases, etc.
- **Importar datos:** cargar productos masivamente desde un archivo CSV.
- **Respaldos:** generar copias de seguridad de la base de datos.

---

## 15. Preguntas frecuentes

**¿Por qué no me deja vender un producto?**
Puede que no haya existencia suficiente, o que la caja no esté abierta.

**¿Por qué no veo un módulo en el menú?**
Tu rol no tiene ese permiso. Pedile al administrador que te lo active en
**Administración → Roles**.

**El cliente pide el comprobante por WhatsApp.**
Desde el ticket de la venta, botón **💬 WhatsApp**. Para el PDF completo, usá
**Imprimir / PDF → Guardar como PDF** y adjuntalo en el chat.

**Si cambio el precio de un producto, ¿cambian las ventas viejas?**
No. Cada venta guarda el precio al que se vendió en ese momento. El historial no
se altera.

**¿Se pone lento con miles de productos?**
No. El sistema usa paginación (carga por páginas), índices de base de datos y
corre sobre PostgreSQL, pensado para ese volumen.

**Se fue el internet en plena venta.**
El POS sigue funcionando offline; las ventas se sincronizan solas al volver la
conexión.

---

*Manual de usuario — Ferretería Central. Para dudas técnicas o cambios,
contactá al administrador del sistema.*
