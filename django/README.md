# Ferretería — versión Django

Migración del sistema de gestión de ferretería (originalmente en Laravel) a
**Python + Django 5.1**, con plantillas renderizadas en servidor (Tailwind vía
CDN + Alpine.js) y PostgreSQL en producción / SQLite en desarrollo.

> Esta es una migración **incremental**. La app Laravel original sigue en la
> raíz del repositorio como referencia. Aquí se van portando los módulos uno
> por uno, dejando cada uno funcional y verificable.

## Estado de la migración

| Módulo | Estado |
|--------|--------|
| Proyecto base, settings, multi-sucursal en sesión | ✅ |
| Autenticación + roles (admin / vendedor / almacenista) | ✅ |
| Inventario: productos, categorías, marcas, unidades | ✅ |
| Inventario: movimientos de stock (entrada/salida/ajuste) con multi-sucursal | ✅ |
| Inventario: stock bajo y conteo físico masivo | ✅ |
| Proveedores y compras | ⏳ pendiente |
| Clientes | ⏳ pendiente |
| Punto de Venta (POS) | ⏳ pendiente |
| Caja | ⏳ pendiente |
| Cotizaciones, devoluciones | ⏳ pendiente |
| Facturación / FEL Guatemala | ⏳ pendiente |
| Reportes, auditoría, backups | ⏳ pendiente |

## Requisitos

- Python 3.11+
- PostgreSQL 13+ (opcional en desarrollo; SQLite funciona out-of-the-box)

## Instalación en desarrollo

```bash
cd django
pip install -r requirements.txt
cp .env.example .env        # ya viene un .env de desarrollo con SQLite
python manage.py migrate
python manage.py seed_demo   # crea roles, sucursal y usuario admin
python manage.py runserver
```

Acceso por defecto:

- **Correo:** `admin@ferreteria.test`
- **Contraseña:** `password`

### Cambiar a PostgreSQL

Edita `.env`:

```env
DB_ENGINE=postgresql
DB_NAME=ferreteria
DB_USER=ferreteria
DB_PASSWORD=tu_password
DB_HOST=127.0.0.1
DB_PORT=5432
```

## Estructura

```
django/
├── config/          # settings, urls, wsgi
├── core/            # Usuario, Sucursal, multi-sucursal, tablero
│   ├── middleware.py        # sucursal activa en sesión
│   ├── context_processors.py
│   └── management/commands/seed_demo.py
├── inventory/       # Productos, categorías, marcas, unidades, stock
│   ├── models.py    # Product, Category, Brand, Unit, ProductStock,
│   │                #   ProductPresentation, ProductSubstitute, InventoryMovement
│   ├── services.py  # apply_movement(): lógica de stock con bloqueo y multi-sucursal
│   ├── utils.py     # parseo de fracciones, autogeneración SKU/EAN-13
│   ├── forms.py
│   └── views.py
└── templates/
```

## Notas de la migración

- El **stock por sucursal** vive en `ProductStock`; el `Product.stock` global es
  la suma de todas las sucursales. La primera fila de stock de un producto
  hereda el stock global; las siguientes empiezan en cero (igual que Laravel).
- Los **movimientos** se aplican con `inventory.services.apply_movement()` dentro
  de una transacción con `select_for_update()` para evitar condiciones de carrera.
- El **SKU** se autogenera con prefijo de 3 letras del nombre + contador; el
  **código de barras** es un EAN-13 interno (prefijo `200`).
- Se soportan empaques (caja/rollo/fardo), precios mayorista/constructor, venta
  por medida e impuesto IVA/exento, igual que el modelo original.
