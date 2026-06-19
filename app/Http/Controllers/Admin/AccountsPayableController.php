<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Models\PurchasePayment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class AccountsPayableController extends Controller
{
    public function index(Request $request): View
    {
        $supplierId = $request->integer('supplier_id') ?: null;
        $overdueOnly = $request->boolean('overdue');

        $purchases = Purchase::with(['supplier', 'payments'])
            ->where('payment_status', '!=', 'pagada')
            ->whereColumn('amount_paid', '<', 'total')
            ->when($supplierId, fn ($q) => $q->where('supplier_id', $supplierId))
            ->when($overdueOnly, fn ($q) => $q->whereNotNull('due_date')->whereDate('due_date', '<', now()))
            ->orderBy('due_date')
            ->paginate(20);

        $totalOwed = Purchase::where('payment_status', '!=', 'pagada')
            ->select(DB::raw('SUM(total - amount_paid) as owed'))
            ->value('owed') ?? 0;

        $overdueAmount = Purchase::where('payment_status', '!=', 'pagada')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', now())
            ->select(DB::raw('SUM(total - amount_paid) as owed'))
            ->value('owed') ?? 0;

        $bySupplier = Purchase::with('supplier')
            ->where('payment_status', '!=', 'pagada')
            ->select('supplier_id', DB::raw('SUM(total - amount_paid) as owed'), DB::raw('COUNT(*) as count'))
            ->groupBy('supplier_id')
            ->orderByDesc('owed')
            ->get();

        return view('admin.accounts_payable.index', compact('purchases', 'totalOwed', 'overdueAmount', 'bySupplier', 'overdueOnly'));
    }

    public function pay(Request $request, Purchase $compra): RedirectResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method' => ['required', 'in:efectivo,transferencia,cheque,deposito'],
            'date' => ['required', 'date'],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($data, $compra) {
            PurchasePayment::create([
                'purchase_id' => $compra->id,
                'user_id' => auth()->id(),
                'date' => $data['date'],
                'amount' => $data['amount'],
                'payment_method' => $data['payment_method'],
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $newPaid = (float) $compra->amount_paid + (float) $data['amount'];
            $compra->update([
                'amount_paid' => $newPaid,
                'payment_status' => $newPaid >= (float) $compra->total ? 'pagada' : 'parcial',
            ]);
        });

        return back()->with('status', 'Pago registrado.');
    }
}
