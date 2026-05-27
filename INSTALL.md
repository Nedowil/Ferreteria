# Cómo instalar Ferretería Central

## ✨ Instalación rápida (recomendado)

Una vez descomprimido el proyecto, abre la terminal en la carpeta y ejecuta **un solo comando**:

### Windows
```powershell
.\install.bat
```

### Mac / Linux
```bash
./install.sh
```

El script hace todo lo necesario:
1. Crea las carpetas internas de Laravel
2. Instala dependencias PHP (Composer)
3. Instala dependencias JS y compila los assets
4. Configura el archivo `.env`
5. Genera la clave de aplicación
6. Crea la base de datos SQLite (si no usas MySQL)
7. Ejecuta migraciones y carga los datos iniciales
8. Limpia caché y deja el sistema listo

Al terminar verás las credenciales:
- **Email:** `admin@ferreteria.test`
- **Contraseña:** `password`

Para iniciar el servidor:
```bash
php artisan serve
```

Abre **http://127.0.0.1:8000** en tu navegador.

---

## 🛠️ Comando artisan personalizado

Si ya hiciste `composer install` y solo necesitas reparar el sistema (carpetas faltantes, migraciones nuevas, etc.):

```bash
php artisan ferreteria:install
```

Opciones:
- `php artisan ferreteria:install --fresh` — **borra todos los datos** y vuelve a sembrar desde cero (útil para empezar limpio)

---

## 💾 Usar MySQL en vez de SQLite

1. Crea la base de datos en MySQL Workbench:
   ```sql
   CREATE DATABASE ferreteria CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Edita `.env`:
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=ferreteria
   DB_USERNAME=root
   DB_PASSWORD=tu_password
   ```
3. Ejecuta:
   ```bash
   php artisan ferreteria:install --fresh
   ```

---

## ⚠️ Requisitos previos

- **PHP 8.2 o superior**
- **Composer 2.x**
- **Node.js 18+** (npm)
- **MySQL 5.7+** (solo si no quieres SQLite)

Verifica que estén instalados:
```bash
php --version
composer --version
node --version
```

---

## 🔧 Problemas comunes

**"Please provide a valid cache path"**
→ Faltan carpetas internas. Corre `.\install.bat` o `php artisan ferreteria:install`.

**"could not find driver"**
→ Falta la extensión PHP `pdo_sqlite` o `pdo_mysql`. Actívala en tu `php.ini`.

**"npm : No se puede cargar el archivo"** (PowerShell)
→ Política de scripts bloqueada. Ejecuta una vez:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Error "Your lock file does not contain a compatible set of packages"**
→ Borra `composer.lock` y vuelve a correr `composer install`.
