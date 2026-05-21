<?php

namespace App\Services;

use App\Models\CashMovement;
use App\Models\CashSession;
use App\Models\Sale;
use Illuminate\Support\Facades\DB;

class CashService
{
    public function currentSessionFor(int $userId): ?CashSession
    {
        return CashSession::where('user_id', $userId)
            ->where('status', CashSession::STATUS_ABIERTA)
            ->latest('opened_at')
            ->first();
    }

    public function open(int $userId, float $openingAmount, ?string $notes = null, ?int $branchId = null): CashSession
    {
        return DB::transaction(function () use ($userId, $openingAmount, $notes, $branchId) {
            if ($this->currentSessionFor($userId)) {
                throw new \DomainException('Ya tienes una sesion de caja abierta.');
            }

            return CashSession::create([
                'branch_id' => $branchId,
                'user_id' => $userId,
                'opened_at' => now(),
                'opening_amount' => $openingAmount,
                'expected_cash' => $openingAmount,
                'status' => CashSession::STATUS_ABIERTA,
                'opening_notes' => $notes,
            ]);
        });
    }

    public function registerSale(Sale $sale): ?CashMovement
    {
        if (! $sale->user_id) {
            return null;
        }

        $session = $this->currentSessionFor($sale->user_id);
        if (! $session) {
            return null;
        }

        $sale->cash_session_id = $session->id;
        $sale->save();

        $movement = CashMovement::create([
            'cash_session_id' => $session->id,
            'user_id' => $sale->user_id,
            'sale_id' => $sale->id,
            'type' => CashMovement::TYPE_VENTA,
            'payment_method' => $sale->payment_method,
            'amount' => $sale->total,
            'description' => "Venta {$sale->folio}",
        ]);

        $this->recomputeExpected($session);

        return $movement;
    }

    public function registerSaleCancellation(Sale $sale): ?CashMovement
    {
        if (! $sale->cash_session_id) {
            return null;
        }

        $session = CashSession::find($sale->cash_session_id);
        if (! $session) {
            return null;
        }

        $movement = CashMovement::create([
            'cash_session_id' => $session->id,
            'user_id' => auth()->id(),
            'sale_id' => $sale->id,
            'type' => CashMovement::TYPE_DEVOLUCION,
            'payment_method' => $sale->payment_method,
            'amount' => $sale->total,
            'description' => "Cancelacion venta {$sale->folio}",
        ]);

        if ($session->isAbierta()) {
            $this->recomputeExpected($session);
        }

        return $movement;
    }

    public function registerMovement(
        CashSession $session,
        string $type,
        float $amount,
        ?string $description,
        ?int $userId = null,
    ): CashMovement {
        if (! in_array($type, [CashMovement::TYPE_INGRESO, CashMovement::TYPE_EGRESO], true)) {
            throw new \InvalidArgumentException('Tipo de movimiento manual invalido.');
        }

        if (! $session->isAbierta()) {
            throw new \DomainException('La sesion esta cerrada.');
        }

        if ($amount <= 0) {
            throw new \DomainException('El monto debe ser mayor a cero.');
        }

        return DB::transaction(function () use ($session, $type, $amount, $description, $userId) {
            $movement = CashMovement::create([
                'cash_session_id' => $session->id,
                'user_id' => $userId,
                'type' => $type,
                'payment_method' => 'efectivo',
                'amount' => $amount,
                'description' => $description,
            ]);

            $this->recomputeExpected($session);

            return $movement;
        });
    }

    public function close(CashSession $session, float $countedCash, ?string $notes = null): CashSession
    {
        return DB::transaction(function () use ($session, $countedCash, $notes) {
            $session = CashSession::lockForUpdate()->findOrFail($session->id);

            if (! $session->isAbierta()) {
                throw new \DomainException('La sesion ya esta cerrada.');
            }

            $expected = $this->computeExpected($session);

            $session->update([
                'closed_at' => now(),
                'expected_cash' => $expected,
                'counted_cash' => $countedCash,
                'difference' => $countedCash - $expected,
                'status' => CashSession::STATUS_CERRADA,
                'closing_notes' => $notes,
            ]);

            return $session;
        });
    }

    public function computeExpected(CashSession $session): float
    {
        $ventas = CashMovement::where('cash_session_id', $session->id)
            ->where('type', CashMovement::TYPE_VENTA)
            ->where('payment_method', 'efectivo')
            ->sum('amount');

        $devoluciones = CashMovement::where('cash_session_id', $session->id)
            ->where('type', CashMovement::TYPE_DEVOLUCION)
            ->where('payment_method', 'efectivo')
            ->sum('amount');

        $ingresos = CashMovement::where('cash_session_id', $session->id)
            ->where('type', CashMovement::TYPE_INGRESO)
            ->sum('amount');

        $egresos = CashMovement::where('cash_session_id', $session->id)
            ->where('type', CashMovement::TYPE_EGRESO)
            ->sum('amount');

        return (float) $session->opening_amount + (float) $ventas + (float) $ingresos - (float) $devoluciones - (float) $egresos;
    }

    /**
     * @return array{efectivo:float, tarjeta:float, transferencia:float}
     */
    public function totalsByPaymentMethod(CashSession $session): array
    {
        $base = ['efectivo' => 0.0, 'tarjeta' => 0.0, 'transferencia' => 0.0];

        $ventas = CashMovement::where('cash_session_id', $session->id)
            ->where('type', CashMovement::TYPE_VENTA)
            ->selectRaw('payment_method, COALESCE(SUM(amount),0) as total')
            ->groupBy('payment_method')
            ->pluck('total', 'payment_method')
            ->toArray();

        $devoluciones = CashMovement::where('cash_session_id', $session->id)
            ->where('type', CashMovement::TYPE_DEVOLUCION)
            ->selectRaw('payment_method, COALESCE(SUM(amount),0) as total')
            ->groupBy('payment_method')
            ->pluck('total', 'payment_method')
            ->toArray();

        foreach ($base as $method => $_) {
            $base[$method] = (float) ($ventas[$method] ?? 0) - (float) ($devoluciones[$method] ?? 0);
        }

        return $base;
    }

    private function recomputeExpected(CashSession $session): void
    {
        $session->update(['expected_cash' => $this->computeExpected($session)]);
    }
}
