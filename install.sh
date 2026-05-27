#!/usr/bin/env bash
# ============================================================
#  Ferreteria Central - Instalador para Linux / macOS
# ============================================================
set -e

echo
echo "  ###################################################"
echo "  #  FERRETERIA CENTRAL - Instalador automatico    #"
echo "  ###################################################"
echo

echo "[1/6] Creando carpetas necesarias..."
mkdir -p storage/framework/{cache/data,sessions,views,testing}
mkdir -p storage/logs
mkdir -p storage/app/{public,backups}
mkdir -p bootstrap/cache
echo "      Carpetas listas."
echo

echo "[2/6] Instalando dependencias PHP (puede tardar 1-2 minutos)..."
composer install --no-interaction
echo

echo "[3/6] Instalando dependencias JS..."
npm install --silent
echo "      Compilando assets..."
npm run build
echo

echo "[4/6] Configurando archivo .env..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "      .env creado desde .env.example"
else
    echo "      .env ya existe."
fi
echo

echo "[5/6] Preparando base de datos..."
if [ ! -f database/database.sqlite ]; then
    touch database/database.sqlite
    echo "      database.sqlite creado."
fi
php artisan key:generate --force --ansi
echo

echo "[6/6] Ejecutando migraciones y datos iniciales..."
php artisan ferreteria:install --no-interaction
echo

echo "  ###################################################"
echo "  #  Instalacion completada                         #"
echo "  #                                                 #"
echo "  #  Para iniciar el servidor:                      #"
echo "  #    php artisan serve                            #"
echo "  #                                                 #"
echo "  #  Abre en navegador:                             #"
echo "  #    http://127.0.0.1:8000                        #"
echo "  #                                                 #"
echo "  #  Login:                                         #"
echo "  #    admin@ferreteria.test  /  password           #"
echo "  ###################################################"
echo
