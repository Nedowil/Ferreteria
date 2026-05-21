<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Artisan;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BackupController extends Controller
{
    public function index(): View
    {
        $files = collect(glob(storage_path('app/backups/ferreteria-*.zip')) ?: [])
            ->map(fn ($path) => [
                'name' => basename($path),
                'size' => round(filesize($path) / 1024 / 1024, 2),
                'date' => date('Y-m-d H:i:s', filemtime($path)),
            ])
            ->sortByDesc('date')
            ->values();

        return view('admin.backup.index', compact('files'));
    }

    public function run(): RedirectResponse
    {
        Artisan::call('backup:run');

        return back()->with('status', 'Backup ejecutado: ' . trim(Artisan::output()));
    }

    public function download(string $filename): BinaryFileResponse
    {
        // Anti path-traversal
        if (! preg_match('/^ferreteria-[0-9_\-]+\.zip$/', $filename)) {
            abort(404);
        }
        $path = storage_path("app/backups/{$filename}");
        if (! is_file($path)) {
            abort(404);
        }

        return response()->download($path);
    }

    public function destroy(string $filename): RedirectResponse
    {
        if (! preg_match('/^ferreteria-[0-9_\-]+\.zip$/', $filename)) {
            abort(404);
        }
        $path = storage_path("app/backups/{$filename}");
        if (is_file($path)) {
            @unlink($path);
        }

        return back()->with('status', 'Backup eliminado.');
    }
}
