@echo off
REM ============================================================
REM  Ferreteria Central - Instalador para Windows
REM ============================================================
echo.
echo  ###################################################
echo  #  FERRETERIA CENTRAL - Instalador automatico    #
echo  ###################################################
echo.

REM 1. Crear carpetas necesarias de Laravel
echo [1/6] Creando carpetas necesarias...
if not exist "storage\framework\cache\data" mkdir "storage\framework\cache\data"
if not exist "storage\framework\sessions" mkdir "storage\framework\sessions"
if not exist "storage\framework\views" mkdir "storage\framework\views"
if not exist "storage\framework\testing" mkdir "storage\framework\testing"
if not exist "storage\logs" mkdir "storage\logs"
if not exist "storage\app\public" mkdir "storage\app\public"
if not exist "storage\app\backups" mkdir "storage\app\backups"
if not exist "bootstrap\cache" mkdir "bootstrap\cache"
echo      Carpetas listas.
echo.

REM 2. Instalar dependencias PHP
echo [2/6] Instalando dependencias PHP (puede tardar 1-2 minutos)...
call composer install --no-interaction
if %errorlevel% neq 0 goto :error
echo.

REM 3. Instalar dependencias JS y compilar
echo [3/6] Instalando dependencias JS...
call npm install --silent
if %errorlevel% neq 0 goto :error
echo      Compilando assets...
call npm run build
if %errorlevel% neq 0 goto :error
echo.

REM 4. Configurar .env
echo [4/6] Configurando archivo .env...
if not exist ".env" (
    copy .env.example .env
    echo      .env creado desde .env.example
) else (
    echo      .env ya existe.
)
echo.

REM 5. Generar APP_KEY y crear BD SQLite si no hay
echo [5/6] Preparando base de datos...
if not exist "database\database.sqlite" (
    type nul > database\database.sqlite
    echo      database.sqlite creado.
)
call php artisan key:generate --force --ansi
echo.

REM 6. Migraciones, seeders y limpieza
echo [6/6] Ejecutando migraciones y datos iniciales...
call php artisan ferreteria:install --no-interaction
echo.

echo ###################################################
echo #  Instalacion completada                         #
echo #                                                 #
echo #  Para iniciar el servidor:                      #
echo #    php artisan serve                            #
echo #                                                 #
echo #  Abre en navegador:                             #
echo #    http://127.0.0.1:8000                        #
echo #                                                 #
echo #  Login:                                         #
echo #    admin@ferreteria.test  /  password           #
echo ###################################################
echo.
pause
goto :eof

:error
echo.
echo  X Ocurrio un error durante la instalacion.
echo.
pause
exit /b 1
