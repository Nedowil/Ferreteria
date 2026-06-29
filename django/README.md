# Ferretería — versión Django (API REST + SPA)

Migración del sistema de gestión de ferretería (originalmente en Laravel) a una
arquitectura **desacoplada**:

- **Backend:** Python + **Django 5.1** + **Django REST Framework**, autenticación
  con **JWT** (SimpleJWT). PostgreSQL en producción / SQLite en desarrollo.
- **Frontend:** SPA en **React 18 + Vite**, estilado con **Tailwind CSS**, que
  consume la API REST.

> Migración **incremental**. La app Laravel original sigue en la raíz del
> repositorio como referencia. Aquí se portan los módulos uno por uno.

## Estado de la migración

| Módulo | API | SPA |
|--------|-----|-----|
| Auth JWT + perfil + roles | ✅ | ✅ |
| Multi-sucursal (header `X-Branch-Id`) | ✅ | ✅ |
| Inventario: productos, categorías, marcas, unidades | ✅ | ✅ |
| Inventario: movimientos, stock bajo, conteo físico | ✅ | ✅ |
| Proveedores y Clientes | ✅ | ✅ |
| Compras (pendiente → recibida → entra a inventario) | ✅ | ✅ |
| Compras al crédito + cuentas por pagar (abonos) | ✅ | ✅ |
| Punto de Venta (POS) con niveles de precio y vuelto | ✅ | ✅ |
| Caja (apertura, movimientos, arqueo y cierre) | ✅ | ✅ |
| Ventas al crédito + cuentas por cobrar (abonos) | ✅ | ✅ |
| Cotizaciones (crear, convertir a venta) | ✅ | ✅ |
| Devoluciones (por ticket / por producto / sin ticket) | ✅ | ✅ |
| Reportes (ventas, utilidad, top, stock muerto, caja, inventario) | ✅ | ✅ |
| Usuarios, roles y permisos (53 permisos, enforcement por rol) | ✅ | ✅ |
| Sucursales + transferencias de stock entre sucursales | ✅ | ✅ |
| Auditoría (bitácora create/update/delete) | ✅ | ✅ |
| Configuración de empresa (datos fiscales, IVA, FEL, impresoras) | ✅ | ✅ |
| Facturación / FEL Guatemala (emisión, anulación, cupo, ticket) | ✅ | ✅ |

## Requisitos

- Python 3.11+
- Node 18+
- PostgreSQL 13+ (opcional en desarrollo; SQLite funciona out-of-the-box)

## Puesta en marcha (desarrollo)

### Backend (API en http://localhost:8000)

```bash
cd django
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # trae un .env de desarrollo con SQLite
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
.venv/bin/python manage.py runserver
```

### Frontend (SPA en http://localhost:5173)

```bash
cd django/frontend
npm install
npm run dev
```

El SPA proxya `/api` y `/media` al backend (ver `vite.config.js`).

### Tests

```bash
cd django
.venv/bin/python manage.py test
```

Cubren la lógica crítica: servicio de stock (`apply_movement`: entrada/salida/
ajuste, guarda de negativo, multi-sucursal), utilidades (SKU, EAN-13,
fracciones), servicio de compras (totales con IVA solo sobre lo gravado,
recepción que genera inventario y actualiza costo, abonos y cuentas por pagar)
y la capa API con JWT (creación de productos, movimientos, flujo de compra).

Acceso por defecto:

- **Correo:** `admin@ferreteria.test`
- **Contraseña:** `password`

## La API

Base: `/api/`. Autenticación: `Authorization: Bearer <access>`. La sucursal
activa viaja en el header `X-Branch-Id`.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/token/` | Login → `{access, refresh}` |
| POST | `/api/auth/token/refresh/` | Renovar access token |
| GET | `/api/auth/me/` | Usuario actual + sucursal |
| GET | `/api/dashboard/` | KPIs del tablero |
| GET | `/api/branches/` | Sucursales del usuario |
| CRUD | `/api/inventory/products/` | Productos (filtros: `search`, `category`, `brand`, `low_stock`) |
| GET/POST | `/api/inventory/products/{id}/movements/` | Historial / aplicar movimiento |
| GET | `/api/inventory/products/low-stock/` | Stock bajo + sugerencia de compra |
| POST | `/api/inventory/stock-count/` | Conteo físico masivo |
| CRUD | `/api/inventory/categories/`, `/brands/`, `/units/` | Catálogos |
| CRUD | `/api/suppliers/`, `/api/customers/` | Proveedores y clientes |
| CRUD | `/api/purchases/` | Compras (cabecera + partidas) |
| POST | `/api/purchases/{id}/receive/` | Recibir → genera entradas de inventario |
| POST | `/api/purchases/{id}/cancel/` | Cancelar compra pendiente |
| GET/POST | `/api/purchases/{id}/payments/` | Abonos (cuentas por pagar) |
| GET | `/api/purchases/payable/` | Compras con saldo pendiente |
| CRUD | `/api/sales/` | Ventas POS (crear descuenta stock y registra en caja) |
| POST | `/api/sales/{id}/cancel/` | Cancelar venta (revierte stock) |
| GET/POST | `/api/sales/{id}/payments/` | Abonos (cuentas por cobrar) |
| GET | `/api/sales/receivable/` | Ventas al crédito con saldo |
| GET | `/api/cashbox/cash-sessions/current/` | Caja abierta del usuario |
| POST | `/api/cashbox/cash-sessions/open/` | Abrir caja |
| POST | `/api/cashbox/cash-sessions/{id}/movement/` | Ingreso/egreso |
| POST | `/api/cashbox/cash-sessions/{id}/close/` | Arqueo y cierre |
| CRUD | `/api/quotations/` | Cotizaciones |
| POST | `/api/quotations/{id}/convert/` | Convertir cotización en venta |
| POST | `/api/quotations/{id}/cancel/` | Cancelar cotización |
| CRUD | `/api/returns/` | Devoluciones (con venta de origen) |
| POST | `/api/returns/without-sale/` | Devolución sin ticket |
| GET | `/api/returns/search-by-product/` | Buscar ventas por producto |
| POST | `/api/returns/{id}/cancel/` | Cancelar devolución (revierte stock) |
| GET | `/api/reports/sales/` | Ventas por periodo (KPIs, por día, por método) |
| GET | `/api/reports/profit/` | Utilidad bruta (ingreso − costo, margen) |
| GET | `/api/reports/top-products/` · `top-customers/` · `top-suppliers/` | Rankings |
| GET | `/api/reports/by-seller/` · `by-category/` | Ventas por vendedor / categoría |
| GET | `/api/reports/dead-stock/` | Productos sin salidas en N días |
| GET | `/api/reports/daily-cash/` | Corte diario de caja |
| GET | `/api/reports/inventory-value/` | Valor de inventario (costo y venta) |
| CRUD | `/api/users/` · `/api/roles/` · `/api/branches/` | Usuarios, roles y sucursales |
| GET | `/api/permissions/` | Catálogo de permisos para la UI de roles |
| CRUD | `/api/transfers/` | Transferencias entre sucursales |
| POST | `/api/transfers/{id}/send/` · `/receive/` · `/cancel/` | Enviar / recibir / cancelar |
| GET | `/api/audit-logs/` · `/api/audit-logs/summary/` | Bitácora de auditoría |
| GET/PUT | `/api/company-settings/` | Configuración de empresa (edición: `configuracion.gestionar`) |
| GET | `/api/invoices/` | Facturas electrónicas (filtros: `status`, `document_type`, `sale`) |
| POST | `/api/sales/{id}/emit-invoice/` | Emitir/certificar la factura (FEL) de una venta |
| POST | `/api/invoices/{id}/annul/` | Anular factura certificada (requiere `reason`) |
| GET | `/api/invoices/quota/` | Cupo del bolsón de DTEs del ciclo |
| GET | `/api/invoices/pending/` | Ventas completadas sin factura certificada |
| GET | `/api/sales/{id}/ticket/` | Datos del comprobante para imprimir |
| GET | `/api/fel/config/` | Configuración del certificador FEL activo |

### Facturación Electrónica (FEL Guatemala)

El módulo `billing` certifica DTEs a través de un **adaptador** (`billing/fel/`):
el driver se elige con `FEL_DRIVER` (por defecto `stub`, que simula la respuesta
del certificador SAT generando UUID de autorización, serie y número — útil para
desarrollo y demo sin credenciales). Para producción se implementa un certificador
real (Infile/otro) con la misma interfaz `FelCertifier`. Pequeños contribuyentes
emiten `FPEQ`; régimen general emite `FACT`. El cupo anual (bolsón) se controla
en la configuración de empresa (`fel_yearly_quota`, `0` = sin límite).

## Estructura

```
django/
├── config/          # settings (DRF/JWT/CORS), urls de la API, paginación
├── core/            # Usuario, Sucursal, auth API, dashboard, seed_demo
│   ├── serializers.py
│   ├── api_utils.py         # resolución de sucursal por header
│   └── views.py             # me / dashboard / BranchViewSet
├── inventory/       # Inventario
│   ├── models.py            # Product, Category, Brand, Unit, ProductStock,
│   │                        #   ProductPresentation, ProductSubstitute, InventoryMovement
│   ├── services.py          # apply_movement(): stock con bloqueo + multi-sucursal
│   ├── utils.py             # fracciones, autogeneración SKU/EAN-13
│   ├── serializers.py
│   └── views.py             # viewsets DRF
├── billing/         # Facturación Electrónica (FEL)
│   ├── models.py            # ElectronicInvoice (DTE: estado, serie/número, UUID SAT)
│   ├── services.py          # emit_invoice / cancel_invoice / quota_status / build_ticket
│   ├── fel/                 # adaptador del certificador (base + stub) y build_dte
│   └── views.py             # emisión, anulación, cupo, ticket, config FEL
└── frontend/        # SPA React + Vite + Tailwind
    └── src/
        ├── api/client.js        # axios + interceptores JWT (refresh) + X-Branch-Id
        ├── auth/AuthContext.jsx
        ├── components/Layout.jsx
        └── pages/               # Login, Dashboard, products/*, catalogs/*
```

## Notas de la migración

- **JWT stateless:** el access token dura 60 min y se renueva automáticamente
  con el refresh token (interceptor de axios). La sucursal activa se guarda en
  `localStorage` y viaja como header `X-Branch-Id`.
- **Stock por sucursal** en `ProductStock`; `Product.stock` global = suma de
  sucursales. Movimientos vía `apply_movement()` con `select_for_update()`.
- **SKU** autogenerado (3 letras + contador) y **código de barras** EAN-13 interno.
