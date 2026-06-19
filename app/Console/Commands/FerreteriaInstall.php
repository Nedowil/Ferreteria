<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class FerreteriaInstall extends Command
{
    protected $signature = 'ferreteria:install {--fresh : Reinicia toda la BD (borra datos)}';

    protected $description = 'Instala/repara Ferreteria Central: crea carpetas, ejecuta migraciones y prepara el sistema en un solo paso';

    public function handle(): int
    {
        $this->newLine();
        $this->line('  <bg=yellow;fg=black> 🔧 Ferreteria Central - Instalador </>');
        $this->newLine();

        $this->step('1/6', 'Creando carpetas necesarias');
        $this->createDirectories();

        $this->step('2/6', 'Verificando archivo .env');
        $this->ensureEnv();

        $this->step('3/6', 'Generando clave de aplicacion (si falta)');
        $this->ensureAppKey();

        $this->step('4/6', 'Preparando base de datos');
        $this->ensureDatabase();

        $this->step('5/6', 'Ejecutando migraciones y datos iniciales');
        $this->runMigrations();

        $this->step('6/6', 'Limpiando caches y enlazando storage publico');
        $this->finalize();

        $this->newLine();
        $this->line('  <bg=green;fg=white> ✓ Instalacion completada </>');
        $this->newLine();
        $this->line('  Inicia el servidor con: <fg=cyan>php artisan serve</>');
        $this->line('  Abre en navegador:      <fg=cyan>http://127.0.0.1:8000</>');
        $this->line('  Credenciales por defecto:');
        $this->line('    Email:      <fg=yellow>admin@ferreteria.test</>');
        $this->line('    Contraseña: <fg=yellow>password</>');
        $this->newLine();

        return self::SUCCESS;
    }

    private function step(string $num, string $description): void
    {
        $this->line("  <fg=cyan>[{$num}]</> {$description}");
    }

    private function createDirectories(): void
    {
        $dirs = [
            storage_path('framework/cache/data'),
            storage_path('framework/sessions'),
            storage_path('framework/views'),
            storage_path('framework/testing'),
            storage_path('logs'),
            storage_path('app/public'),
            storage_path('app/backups'),
            base_path('bootstrap/cache'),
        ];

        foreach ($dirs as $dir) {
            if (! File::isDirectory($dir)) {
                File::makeDirectory($dir, 0775, true);
                $this->line("      <fg=green>+</> {$dir}");
            }
        }
        $this->line('      <fg=gray>Carpetas listas</>');
    }

    private function ensureEnv(): void
    {
        if (! File::exists(base_path('.env'))) {
            if (File::exists(base_path('.env.example'))) {
                File::copy(base_path('.env.example'), base_path('.env'));
                $this->line('      <fg=green>+</> .env creado desde .env.example');
            } else {
                $this->error('      No se encontro .env ni .env.example');
            }
        } else {
            $this->line('      <fg=gray>.env ya existe</>');
        }
    }

    private function ensureAppKey(): void
    {
        $env = File::get(base_path('.env'));
        if (preg_match('/^APP_KEY=base64:.+$/m', $env)) {
            $this->line('      <fg=gray>APP_KEY ya esta configurado</>');
            return;
        }
        Artisan::call('key:generate', ['--force' => true]);
        $this->line('      <fg=green>+</> APP_KEY generado');
    }

    private function ensureDatabase(): void
    {
        $connection = config('database.default');

        if ($connection === 'sqlite') {
            $path = config("database.connections.sqlite.database");
            if (! File::exists($path)) {
                File::put($path, '');
                $this->line("      <fg=green>+</> Archivo SQLite creado: {$path}");
            } else {
                $this->line('      <fg=gray>SQLite ya existe</>');
            }
            return;
        }

        // MySQL u otra: solo verifica conexion
        try {
            DB::connection()->getPdo();
            $this->line("      <fg=gray>Conexion {$connection} OK</>");
        } catch (\Throwable $e) {
            $this->error('      No se pudo conectar a la base de datos:');
            $this->error('      ' . $e->getMessage());
            $this->warn('      Verifica las credenciales en tu archivo .env');
            exit(1);
        }
    }

    private function runMigrations(): void
    {
        if ($this->option('fresh')) {
            if (! $this->confirm('  ATENCION: --fresh borrara TODOS los datos existentes. Continuar?', false)) {
                $this->warn('      Cancelado por el usuario');
                return;
            }
            Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);
            $this->line('      <fg=green>+</> Base de datos reiniciada con datos demo');
        } else {
            Artisan::call('migrate', ['--force' => true]);
            $this->line('      <fg=green>+</> Migraciones aplicadas');

            // Solo siembra si la tabla users esta vacia
            try {
                if (DB::table('users')->count() === 0) {
                    Artisan::call('db:seed', ['--force' => true]);
                    $this->line('      <fg=green>+</> Datos iniciales sembrados');
                } else {
                    $this->line('      <fg=gray>Datos ya existentes (no se siembra)</>');
                }
            } catch (\Throwable $e) {
                $this->warn('      No se pudo verificar/sembrar datos: ' . $e->getMessage());
            }
        }
    }

    private function finalize(): void
    {
        Artisan::call('config:clear');
        Artisan::call('view:clear');
        Artisan::call('route:clear');
        $this->line('      <fg=green>+</> Caches limpiadas');

        $link = public_path('storage');
        if (! File::exists($link)) {
            try {
                Artisan::call('storage:link');
                $this->line('      <fg=green>+</> Enlace storage publico creado');
            } catch (\Throwable $e) {
                $this->warn('      Storage link: ' . $e->getMessage());
            }
        } else {
            $this->line('      <fg=gray>Storage link ya existe</>');
        }
    }
}
