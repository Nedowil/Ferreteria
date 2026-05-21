<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

#[Signature('backup:run {--keep=14 : Numero de backups a conservar}')]
#[Description('Genera un backup ZIP con la base de datos y archivos de storage/app/public')]
class BackupRun extends Command
{
    public function handle(): int
    {
        $backupsDir = storage_path('app/backups');
        if (! is_dir($backupsDir)) {
            mkdir($backupsDir, 0775, true);
        }

        $timestamp = now()->format('Y-m-d_His');
        $zipPath = "{$backupsDir}/ferreteria-{$timestamp}.zip";

        $zip = new \ZipArchive();
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            $this->error("No se pudo crear el archivo {$zipPath}");

            return self::FAILURE;
        }

        $this->dumpDatabase($zip);
        $this->addPublicStorage($zip);

        $zip->close();

        $sizeMb = round(filesize($zipPath) / 1024 / 1024, 2);
        $this->info("Backup creado: {$zipPath} ({$sizeMb} MB)");

        $this->purgeOld((int) $this->option('keep'));

        return self::SUCCESS;
    }

    private function dumpDatabase(\ZipArchive $zip): void
    {
        $conn = config('database.default');
        $driver = config("database.connections.{$conn}.driver");

        if ($driver === 'sqlite') {
            $path = config("database.connections.{$conn}.database");
            if (is_file($path)) {
                $zip->addFile($path, 'database.sqlite');
                $this->info('Incluida BD SQLite');
            }

            return;
        }

        if ($driver === 'mysql') {
            $tmp = tempnam(sys_get_temp_dir(), 'mysqldump_');
            $cfg = config("database.connections.{$conn}");
            $cmd = sprintf(
                'MYSQL_PWD=%s mysqldump -h %s -P %s -u %s --single-transaction --quick --skip-lock-tables %s > %s 2>&1',
                escapeshellarg((string) $cfg['password']),
                escapeshellarg((string) $cfg['host']),
                escapeshellarg((string) $cfg['port']),
                escapeshellarg((string) $cfg['username']),
                escapeshellarg((string) $cfg['database']),
                escapeshellarg($tmp),
            );
            exec($cmd, $out, $code);
            if ($code === 0 && filesize($tmp) > 0) {
                $zip->addFile($tmp, 'database.sql');
                $this->info('Incluido dump MySQL');
            } else {
                $this->warn("mysqldump fallo (codigo {$code}). Backup continua sin BD.");
            }
        }
    }

    private function addPublicStorage(\ZipArchive $zip): void
    {
        $base = storage_path('app/public');
        if (! is_dir($base)) {
            return;
        }
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($base, \RecursiveDirectoryIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $relative = 'storage/' . str_replace($base . DIRECTORY_SEPARATOR, '', $file->getPathname());
                $zip->addFile($file->getPathname(), $relative);
            }
        }
        $this->info('Incluido storage/app/public');
    }

    private function purgeOld(int $keep): void
    {
        $files = collect(glob(storage_path('app/backups/ferreteria-*.zip')) ?: [])
            ->sort()
            ->values();

        if ($files->count() <= $keep) {
            return;
        }

        $toDelete = $files->slice(0, $files->count() - $keep);
        foreach ($toDelete as $file) {
            @unlink($file);
            $this->info('Eliminado backup antiguo: ' . basename($file));
        }
    }
}
