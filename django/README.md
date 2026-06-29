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
| POS / Caja / Cotizaciones / Devoluciones | ⏳ | ⏳ |
| Facturación / FEL Guatemala / Reportes | ⏳ | ⏳ |

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
