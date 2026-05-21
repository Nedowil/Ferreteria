<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CashMovement;
use App\Models\CashSession;
use App\Services\CashService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class CashController extends Controller
{
    public function __construct(private CashService $service)
    {
    }

    public function index(Request $request): View
    {
        $current = $this->service->currentSessionFor(auth()->id());

        $sessions = CashSession::with('user')
            ->when(! auth()->user()->can('caja.ver_todas'), fn ($q) => $q->where('user_id', auth()->id()))
            ->orderByDesc('opened_at')
            ->paginate(10);

        return view('admin.cash.index', compact('current', 'sessions'));
    }

    public function show(CashSession $caja): View
    {
        $caja->load(['user', 'movements.user', 'movements.sale']);

        $expected = $caja->isAbierta()
            ? $this->service->computeExpected($caja)
            : (float) $caja->expected_cash;

        $totalsByMethod = $this->service->totalsByPaymentMethod($caja);

        return view('admin.cash.show', [
            'session' => $caja,
            'expected' => $expected,
            'totalsByMethod' => $totalsByMethod,
        ]);
    }

    public function open(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'opening_amount' => ['required', 'numeric', 'min:0'],
            'opening_notes' => ['nullable', 'string'],
        ]);

        try {
            $session = $this->service->open(
                userId: auth()->id(),
                openingAmount: (float) $data['opening_amount'],
                notes: $data['opening_notes'] ?? null,
            );
        } catch (\DomainException $e) {
            return back()->withErrors(['open' => $e->getMessage()]);
        }

        return redirect()->route('admin.caja.show', $session)->with('status', 'Caja abierta.');
    }

    public function storeMovement(Request $request, CashSession $caja): RedirectResponse
    {
        if ($caja->user_id !== auth()->id() && ! auth()->user()->hasRole('admin')) {
            abort(403);
        }

        $data = $request->validate([
            'type' => ['required', 'in:ingreso,egreso'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $this->service->registerMovement(
                session: $caja,
                type: $data['type'],
                amount: (float) $data['amount'],
                description: $data['description'] ?? null,
                userId: auth()->id(),
            );
        } catch (\DomainException $e) {
            return back()->withErrors(['movement' => $e->getMessage()]);
        }

        return redirect()->route('admin.caja.show', $caja)->with('status', 'Movimiento registrado.');
    }

    public function close(Request $request, CashSession $caja): RedirectResponse
    {
        if ($caja->user_id !== auth()->id() && ! auth()->user()->hasRole('admin')) {
            abort(403);
        }

        $data = $request->validate([
            'counted_cash' => ['required', 'numeric', 'min:0'],
            'closing_notes' => ['nullable', 'string'],
        ]);

        try {
            $this->service->close(
                session: $caja,
                countedCash: (float) $data['counted_cash'],
                notes: $data['closing_notes'] ?? null,
            );
        } catch (\DomainException $e) {
            return back()->withErrors(['close' => $e->getMessage()]);
        }

        return redirect()->route('admin.caja.show', $caja)->with('status', 'Caja cerrada.');
    }
}
