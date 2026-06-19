<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\SalePayment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class AccountsReceivableController extends Controller
{
    public function index(Request $request): View
    {
        $customerId = $request->integer('customer_id') ?: null;
        $overdueOnly = $request->boolean('overdue');

        $sales = Sale::with(['customer', 'payments'])
            ->where('payment_status', '!=', 'pagada')
            ->where('status', Sale::STATUS_COMPLETADA)
            ->whereColumn('paid_amount', '<', 'total')
            ->when($customerId, fn ($q) => $q->where('customer_id', $customerId))
            ->when($overdueOnly, fn ($q) => $q->whereNotNull('due_date')->whereDate('due_date', '<', now()))
            ->orderBy('due_date')
            ->paginate(20);

        $totalOwed = Sale::where('payment_status', '!=', 'pagada')
            ->where('status', Sale::STATUS_COMPLETADA)
            ->select(DB::raw('SUM(total - paid_amount) as owed'))
            ->value('owed') ?? 0;

        $overdueAmount = Sale::where('payment_status', '!=', 'pagada')
            ->where('status', Sale::STATUS_COMPLETADA)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', now())
            ->select(DB::raw('SUM(total - paid_amount) as owed'))
            ->value('owed') ?? 0;

        $byCustomer = Sale::with('customer')
            ->where('payment_status', '!=', 'pagada')
            ->where('status', Sale::STATUS_COMPLETADA)
            ->select('customer_id', DB::raw('SUM(total - paid_amount) as owed'), DB::raw('COUNT(*) as count'))
            ->groupBy('customer_id')
            ->orderByDesc('owed')
            ->get();

        return view('admin.accounts_receivable.index', compact('sales', 'totalOwed', 'overdueAmount', 'byCustomer', 'overdueOnly'));
    }

    public function receive(Request $request, Sale $venta): RedirectResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method' => ['required', 'in:efectivo,tarjeta,transferencia,cheque,deposito'],
            'date' => ['required', 'date'],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($data, $venta) {
            SalePayment::create([
                'sale_id' => $venta->id,
                'user_id' => auth()->id(),
                'date' => $data['date'],
                'amount' => $data['amount'],
                'payment_method' => $data['payment_method'],
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $newPaid = (float) $venta->paid_amount + (float) $data['amount'];
            $venta->update([
                'paid_amount' => $newPaid,
                'payment_status' => $newPaid >= (float) $venta->total ? 'pagada' : 'parcial',
            ]);
        });

        return back()->with('status', 'Abono registrado.');
    }
}
