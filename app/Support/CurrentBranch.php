<?php

namespace App\Support;

use App\Models\Branch;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;

/**
 * Resuelve la sucursal activa para el usuario. Persiste la seleccion en sesion.
 */
class CurrentBranch
{
    private const SESSION_KEY = 'current_branch_id';

    public static function id(): ?int
    {
        $sessionBranchId = Session::get(self::SESSION_KEY);
        if ($sessionBranchId) {
            return (int) $sessionBranchId;
        }

        $branch = self::resolve();

        if ($branch) {
            Session::put(self::SESSION_KEY, $branch->id);

            return $branch->id;
        }

        return null;
    }

    public static function model(): ?Branch
    {
        $id = self::id();

        return $id ? Branch::find($id) : null;
    }

    public static function set(int $branchId): void
    {
        Session::put(self::SESSION_KEY, $branchId);
    }

    public static function resolve(): ?Branch
    {
        $user = Auth::user();
        if ($user) {
            $assigned = $user->branches()
                ->where('branches.active', true)
                ->orderByDesc('branch_user.is_default')
                ->first();
            if ($assigned) {
                return $assigned;
            }
        }

        return Branch::default();
    }
}
