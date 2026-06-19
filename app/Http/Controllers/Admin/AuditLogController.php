<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuditLogController extends Controller
{
    public function index(Request $request): View
    {
        $event = $request->string('event')->toString();
        $type = $request->string('type')->toString();
        $userId = $request->integer('user_id') ?: null;
        $search = $request->string('q')->toString();
        $from = $request->date('from');
        $to = $request->date('to');

        $logs = AuditLog::with(['user', 'branch'])
            ->when($event, fn ($q) => $q->where('event', $event))
            ->when($type, fn ($q) => $q->where('auditable_type', 'like', "%{$type}"))
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('auditable_id', 'like', "%{$search}%");
            }))
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from->startOfDay()))
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to->endOfDay()))
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        // Catalogo de tipos: nombre amigable
        $rawTypes = AuditLog::query()->select('auditable_type')->distinct()
            ->whereNotNull('auditable_type')->pluck('auditable_type');
        $types = $rawTypes->mapWithKeys(fn ($t) => [$t => class_basename($t)])->filter()->unique();

        $users = User::orderBy('name')->get(['id', 'name']);

        // KPIs del periodo filtrado
        $kpiQuery = AuditLog::query()
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from->startOfDay()))
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to->endOfDay()));
        $totals = [
            'total' => (clone $kpiQuery)->count(),
            'created' => (clone $kpiQuery)->where('event', 'created')->count(),
            'updated' => (clone $kpiQuery)->where('event', 'updated')->count(),
            'deleted' => (clone $kpiQuery)->where('event', 'deleted')->count(),
            'today' => (clone $kpiQuery)->whereDate('created_at', today())->count(),
        ];

        return view('admin.audit.index', compact('logs', 'event', 'type', 'userId', 'search', 'from', 'to', 'types', 'users', 'totals'));
    }

    public function show(AuditLog $log): View
    {
        $log->load(['user', 'branch']);
        return view('admin.audit.show', compact('log'));
    }

    public function export(Request $request): StreamedResponse
    {
        $event = $request->string('event')->toString();
        $type = $request->string('type')->toString();
        $userId = $request->integer('user_id') ?: null;
        $from = $request->date('from');
        $to = $request->date('to');

        $query = AuditLog::with(['user', 'branch'])
            ->when($event, fn ($q) => $q->where('event', $event))
            ->when($type, fn ($q) => $q->where('auditable_type', 'like', "%{$type}"))
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from->startOfDay()))
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to->endOfDay()))
            ->orderByDesc('id');

        $filename = 'auditoria_' . now()->format('Y-m-d_His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        return response()->stream(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Fecha', 'Usuario', 'Sucursal', 'Evento', 'Recurso', 'ID', 'Cambios', 'IP'], ';');

            $query->chunk(200, function ($rows) use ($out) {
                foreach ($rows as $log) {
                    $changes = $log->new_values
                        ? collect($log->new_values)->map(fn ($v, $k) => "{$k}=" . (is_array($v) ? json_encode($v) : $v))->join(' | ')
                        : '';
                    fputcsv($out, [
                        $log->created_at->format('Y-m-d H:i:s'),
                        $log->user?->name ?? 'Sistema',
                        $log->branch?->name ?? '',
                        $log->event,
                        class_basename($log->auditable_type ?? ''),
                        $log->auditable_id,
                        $changes,
                        $log->ip,
                    ], ';');
                }
            });
            fclose($out);
        }, 200, $headers);
    }
}

