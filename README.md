# Ferretería — Sistema de gestión

Aplicación web para administrar una ferretería. Construida en **Laravel 13** con **MySQL** (SQLite soportado para desarrollo local) y autenticación basada en roles y permisos con **spatie/laravel-permission**.

## Módulos planificados

- [x] Autenticación + Usuarios y Roles
- [x] Productos / Inventario (categorías, marcas, unidades, productos, movimientos de stock)
- [x] Proveedores
- [x] Compras (registro pendiente → recibida → genera entradas de inventario)
- [x] Clientes
- [x] Punto de Venta (POS) con ticket imprimible
- [x] Caja (apertura, movimientos manuales ingreso/egreso, arqueo y cierre)
- [x] Reportes (ventas por periodo, top productos/clientes/proveedores, utilidad bruta, stock muerto, corte diario, valor de inventario)
- [x] Facturación: ticket térmico + factura PDF (carta) + cotizaciones con PDF
- [x] FEL Guatemala — scaffolding completo con adapter genérico para certificador
- [x] Multi-sucursal (stock por sucursal, selector en sesión, asignación de usuarios)
- [x] Log de auditoría (create/update/delete) en modelos clave
- [x] Backup automático diario con descarga desde admin
- [x] Envío de facturas y cotizaciones por WhatsApp (signed URLs públicas)
- [x] POS con detección de lector de código de barras automático
- [x] Dashboard con KPIs (ventas hoy, stock bajo)

## Requisitos

- PHP 8.2+
- Composer 2.x
- Node 18+ (solo para compilar assets)
- MySQL 5.7+/8.x en producción (SQLite OK para desarrollo)

## Instalación en desarrollo

```bash
composer install
npm install && npm run build
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate:fresh --seed
php artisan serve
```

Acceso por defecto:

- **Email:** `admin@ferreteria.test`
- **Contraseña:** `password`

## Roles

- `admin` — acceso total, gestiona usuarios y permisos
- `vendedor` — venta y caja (módulos futuros)
- `almacenista` — inventario (módulos futuros)

## Despliegue en hosting compartido (cPanel)

1. Configura MySQL en cPanel y crea base de datos + usuario.
2. Sube el proyecto vía FTP/Administrador de archivos. El contenido de `public/` debe estar en `public_html/` y el resto del proyecto en una carpeta hermana (por ejemplo `ferreteria_app/`). Ajusta las rutas en `public/index.php`.
3. Copia `.env.example` a `.env` y configura `DB_*` con tus credenciales MySQL.
4. Desde el Terminal de cPanel (o SSH):
   ```bash
   composer install --no-dev --optimize-autoloader
   php artisan key:generate
   php artisan migrate --force --seed
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   ```
5. Cambia la contraseña del usuario admin tras el primer login.
