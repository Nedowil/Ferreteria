<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\BranchTransfer;
use App\Models\Product;
use App\Services\BranchTransferService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class BranchTransferController extends Controller
{
    public function __construct(private BranchTransferService $service)
    {
    }

    public function index(Request $request): View
    {
        $status = $request->string('status')->toString();

        $transfers = BranchTransfer::with(['fromBranch', 'toBranch', 'user', 'items'])
            ->when($status, fn ($q) => $q->where('status', $status))
            ->orderByDesc('date')
            ->paginate(20);

        $counts = [
            'pendiente' => BranchTransfer::where('status', 'pendiente')->count(),
            'en_transito' => BranchTransfer::where('status', 'en_transito')->count(),
            'recibida' => BranchTransfer::where('status', 'recibida')->count(),
        ];

        return view('admin.transfers.index', compact('transfers', 'status', 'counts'));
    }

    public function create(): View
    {
        return view('admin.transfers.create', [
            'branches' => Branch::where('active', true)->orderBy('name')->get(),
            'products' => Product::where('active', true)->orderBy('name')->get([
                'id', 'sku', 'name', 'base_unit_label', 'container_label', 'container_factor',
            ]),
            'currentBranchId' => \App\Support\CurrentBranch::id(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'from_branch_id' => ['required', 'exists:branches,id'],
            'to_branch_id' => ['required', 'exists:branches,id', 'different:from_branch_id'],
            'notes' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity_input' => ['required', 'numeric', 'gt:0'],
            'items.*.units_factor' => ['nullable', 'numeric', 'gt:0'],
            'items.*.unit_label' => ['nullable', 'string', 'max:30'],
        ]);

        try {
            $transfer = $this->service->create($data, $data['items'], auth()->id());
        } catch (\DomainException $e) {
            return back()->withErrors(['transfer' => $e->getMessage()])->withInput();
        }

        return redirect()->route('admin.transferencias.show', $transfer)
            ->with('status', "Transferencia {$transfer->folio} creada. Marcala como 'Enviada' cuando salga físicamente de la sucursal origen.");
    }

    public function show(BranchTransfer $transferencia): View
    {
        $transferencia->load(['fromBranch', 'toBranch', 'user', 'sentBy', 'receivedBy', 'items.product']);
        return view('admin.transfers.show', ['transfer' => $transferencia]);
    }

    public function send(BranchTransfer $transferencia): RedirectResponse
    {
        try {
            $this->service->send($transferencia, auth()->id());
        } catch (\DomainException $e) {
            return back()->withErrors(['action' => $e->getMessage()]);
        }
        return back()->with('status', 'Transferencia marcada como ENVIADA. Stock salió de la sucursal origen.');
    }

    public function receive(BranchTransfer $transferencia): RedirectResponse
    {
        try {
            $this->service->receive($transferencia, auth()->id());
        } catch (\DomainException $e) {
            return back()->withErrors(['action' => $e->getMessage()]);
        }
        return back()->with('status', 'Transferencia RECIBIDA. Stock entró a la sucursal destino.');
    }

    public function cancel(Request $request, BranchTransfer $transferencia): RedirectResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);
        try {
            $this->service->cancel($transferencia, $data['reason'], auth()->id());
        } catch (\DomainException $e) {
            return back()->withErrors(['action' => $e->getMessage()]);
        }
        return back()->with('status', 'Transferencia cancelada.');
    }
}
