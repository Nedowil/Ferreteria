<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\PendingOrder;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PendingOrderController extends Controller
{
    public function index(Request $request): View
    {
        $status = $request->string('status')->toString() ?: 'pendiente';

        $orders = PendingOrder::with(['customer', 'product', 'user'])
            ->when($status !== 'todas', fn ($q) => $q->where('status', $status))
            ->orderByDesc('created_at')
            ->paginate(20);

        $counts = [
            'pendiente' => PendingOrder::where('status', 'pendiente')->count(),
            'notificado' => PendingOrder::where('status', 'notificado')->count(),
            'entregado' => PendingOrder::where('status', 'entregado')->count(),
        ];

        return view('admin.pending_orders.index', compact('orders', 'status', 'counts'));
    }

    public function create(): View
    {
        return view('admin.pending_orders.create', [
            'customers' => Customer::where('active', true)->orderBy('name')->get(['id', 'name', 'phone']),
            'products' => Product::where('active', true)->orderBy('name')->get(['id', 'sku', 'name', 'base_unit_label']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'customer_name' => ['nullable', 'string', 'max:180'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'product_id' => ['nullable', 'exists:products,id'],
            'product_description' => ['required', 'string', 'max:255'],
            'quantity' => ['required', 'numeric', 'min:0.01'],
            'unit_label' => ['nullable', 'string', 'max:30'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $next = (PendingOrder::max('id') ?? 0) + 1;
        $data['folio'] = 'PED-' . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
        $data['status'] = 'pendiente';
        $data['user_id'] = auth()->id();
        $data['branch_id'] = \App\Support\CurrentBranch::id();

        PendingOrder::create($data);

        return redirect()->route('admin.pedidos.index')->with('status', 'Pedido pendiente registrado.');
    }

    public function markNotified(PendingOrder $pedido): RedirectResponse
    {
        $pedido->update([
            'status' => 'notificado',
            'notified_at' => now(),
        ]);
        return back()->with('status', 'Marcado como notificado.');
    }

    public function markDelivered(PendingOrder $pedido): RedirectResponse
    {
        $pedido->update([
            'status' => 'entregado',
            'delivered_at' => now(),
        ]);
        return back()->with('status', 'Marcado como entregado.');
    }

    public function cancel(PendingOrder $pedido): RedirectResponse
    {
        $pedido->update(['status' => 'cancelado']);
        return back()->with('status', 'Pedido cancelado.');
    }
}
