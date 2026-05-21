<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AuditLogController extends Controller
{
    public function index(Request $request): View
    {
        $event = $request->string('event')->toString();
        $type = $request->string('type')->toString();
        $userId = $request->integer('user_id') ?: null;
        $from = $request->date('from');
        $to = $request->date('to');

        $logs = AuditLog::with(['user', 'branch'])
            ->when($event, fn ($q) => $q->where('event', $event))
            ->when($type, fn ($q) => $q->where('auditable_type', $type))
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from->startOfDay()))
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to->endOfDay()))
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString();

        $types = AuditLog::query()->select('auditable_type')->distinct()->pluck('auditable_type');

        return view('admin.audit.index', compact('logs', 'event', 'type', 'userId', 'from', 'to', 'types'));
    }
}
