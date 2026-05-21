<?php

namespace App\Models\Concerns;

use App\Models\AuditLog;
use App\Support\CurrentBranch;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(fn (Model $m) => self::recordAudit($m, 'created'));
        static::updated(fn (Model $m) => self::recordAudit($m, 'updated'));
        static::deleted(fn (Model $m) => self::recordAudit($m, 'deleted'));
    }

    /**
     * Columnas que NO se registran en el diff.
     *
     * @return string[]
     */
    public function auditExcluded(): array
    {
        return ['password', 'remember_token', 'updated_at', 'created_at'];
    }

    private static function recordAudit(Model $model, string $event): void
    {
        try {
            $excluded = method_exists($model, 'auditExcluded') ? $model->auditExcluded() : [];

            $old = collect($model->getOriginal())
                ->except($excluded)
                ->filter(fn ($_, $k) => $model->wasChanged($k) || $event === 'deleted')
                ->toArray();

            $new = collect($model->getAttributes())
                ->except($excluded)
                ->filter(fn ($_, $k) => $event === 'created' || $model->wasChanged($k))
                ->toArray();

            if ($event === 'updated' && empty($old) && empty($new)) {
                return;
            }

            AuditLog::create([
                'user_id' => Auth::id(),
                'branch_id' => CurrentBranch::id(),
                'event' => $event,
                'auditable_type' => $model->getMorphClass(),
                'auditable_id' => $model->getKey(),
                'old_values' => $event === 'created' ? null : $old,
                'new_values' => $event === 'deleted' ? null : $new,
                'ip' => Request::ip(),
                'user_agent' => substr((string) Request::userAgent(), 0, 255),
            ]);
        } catch (\Throwable $e) {
            // No bloquear la operacion principal si falla la auditoria
            \Log::warning('Audit log failed: ' . $e->getMessage());
        }
    }
}
