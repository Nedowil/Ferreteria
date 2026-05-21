<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Support\CurrentBranch;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class BranchSwitcherController extends Controller
{
    public function switch(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
        ]);

        $user = $request->user();
        if (! $user->hasRole('admin')) {
            $allowed = $user->branches()->where('branches.id', $data['branch_id'])->exists();
            if (! $allowed) {
                abort(403, 'No tienes acceso a esta sucursal.');
            }
        }

        $branch = Branch::findOrFail($data['branch_id']);
        if (! $branch->active) {
            return back()->withErrors(['branch' => 'La sucursal esta inactiva.']);
        }

        CurrentBranch::set((int) $branch->id);

        return back()->with('status', "Sucursal cambiada a {$branch->name}.");
    }
}
