<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\SaleItem;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class ReportController extends Controller
{
    public function index(): View
    {
        return view('admin.reports.index');
    }

    public function sales(Request $request): View
    {
        [$from, $to] = $this->resolveRange($request, days: 30);

        $sales = Sale::where('status', Sale::STATUS_COMPLETADA)
            ->whereBetween('date', [$from, $to])
            ->get();

        $byDay = $sales->groupBy(fn ($s) => $s->date->toDateString())
            ->map(fn ($group, $day) => [
                'day' => $day,
                'count' => $group->count(),
                'total' => (float) $group->sum('total'),
            ])
            ->sortBy('day')
            ->values();

        // Asegurar que todos los dias del rango aparezcan, aunque sin ventas
        $allDays = collect();
        $cursor = $from->copy();
        while ($cursor->lte($to)) {
            $day = $cursor->toDateString();
            $found = $byDay->firstWhere('day', $day);
            $allDays->push($found ?: ['day' => $day, 'count' => 0, 'total' => 0.0]);
            $cursor->addDay();
        }

        $totalSales = (float) $sales->sum('total');
        $totalCount = $sales->count();
        $avgTicket = $totalCount > 0 ? $totalSales / $totalCount : 0;

        $byPaymentMethod = $sales->groupBy('payment_method')
            ->map(fn ($g) => ['count' => $g->count(), 'total' => (float) $g->sum('total')]);

        return view('admin.reports.sales', [
            'from' => $from,
            'to' => $to,
            'byDay' => $allDays,
            'totalSales' => $totalSales,
            'totalCount' => $totalCount,
            'avgTicket' => $avgTicket,
            'byPaymentMethod' => $byPaymentMethod,
        ]);
    }

    public function topProducts(Request $request): View
    {
        [$from, $to] = $this->resolveRange($request, days: 30);
        $limit = (int) ($request->input('limit', 20));

        $rows = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', Sale::STATUS_COMPLETADA)
            ->whereBetween('sales.date', [$from, $to])
            ->groupBy('products.id', 'products.sku', 'products.name')
            ->orderByDesc(DB::raw('SUM(sale_items.subtotal)'))
            ->limit($limit)
            ->get([
                'products.id',
                'products.sku',
                'products.name',
                DB::raw('SUM(sale_items.quantity) as total_quantity'),
                DB::raw('SUM(sale_items.subtotal) as total_revenue'),
            ]);

        return view('admin.reports.top_products', [
            'from' => $from,
            'to' => $to,
            'rows' => $rows,
            'limit' => $limit,
        ]);
    }

    public function profit(Request $request): View
    {
        [$from, $to] = $this->resolveRange($request, days: 30);

        // CAPITAL (costo): purchase_price es por unidad BASE.
        // cantidad real en unidad base = sale_items.quantity * units_factor
        // Asi 1 caja x 50 lb con purchase_price 9 = 1 * 50 * 9 = Q450 de capital
        $costExpr = 'sale_items.quantity * COALESCE(sale_items.units_factor, 1) * products.purchase_price';
        $revenueExpr = 'sale_items.subtotal'; // ya tiene descuento aplicado

        // Desglose por producto
        $rows = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', Sale::STATUS_COMPLETADA)
            ->whereBetween('sales.date', [$from, $to])
            ->groupBy('products.id', 'products.sku', 'products.name', 'products.purchase_price')
            ->orderByDesc(DB::raw("SUM({$revenueExpr}) - SUM({$costExpr})"))
            ->get([
                'products.id',
                'products.sku',
                'products.name',
                'products.purchase_price',
                DB::raw('SUM(sale_items.quantity) as total_quantity'),
                DB::raw("SUM({$revenueExpr}) as total_revenue"),
                DB::raw("SUM({$costExpr}) as total_cost"),
                DB::raw("SUM({$revenueExpr}) - SUM({$costExpr}) as gross_profit"),
            ]);

        // Desglose por dia
        $byDay = SaleItem::query()
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', Sale::STATUS_COMPLETADA)
            ->whereBetween('sales.date', [$from, $to])
            ->groupBy(DB::raw('DATE(sales.date)'))
            ->orderBy(DB::raw('DATE(sales.date)'), 'desc')
            ->get([
                DB::raw('DATE(sales.date) as day'),
                DB::raw("SUM({$revenueExpr}) as revenue"),
                DB::raw("SUM({$costExpr}) as cost"),
                DB::raw("SUM({$revenueExpr}) - SUM({$costExpr}) as profit"),
                DB::raw('COUNT(DISTINCT sales.id) as sales_count'),
            ]);

        $totalRevenue = (float) $rows->sum('total_revenue');
        $totalCost = (float) $rows->sum('total_cost');
        $totalProfit = $totalRevenue - $totalCost;
        $marginPct = $totalRevenue > 0 ? ($totalProfit / $totalRevenue) * 100 : 0;

        // Top 5 mas y menos rentables
        $topProfit = $rows->sortByDesc('gross_profit')->take(5)->values();
        $lowProfit = $rows->sortBy('gross_profit')->take(5)->values();

        return view('admin.reports.profit', [
            'from' => $from,
            'to' => $to,
            'rows' => $rows,
            'byDay' => $byDay,
            'totalRevenue' => $totalRevenue,
            'totalCost' => $totalCost,
            'totalProfit' => $totalProfit,
            'marginPct' => $marginPct,
            'topProfit' => $topProfit,
            'lowProfit' => $lowProfit,
        ]);
    }

    public function topCustomers(Request $request): View
    {
        [$from, $to] = $this->resolveRange($request, days: 90);

        $rows = Sale::query()
            ->leftJoin('customers', 'customers.id', '=', 'sales.customer_id')
            ->where('sales.status', Sale::STATUS_COMPLETADA)
            ->whereBetween('sales.date', [$from, $to])
            ->groupBy('customers.id', 'customers.name')
            ->orderByDesc(DB::raw('SUM(sales.total)'))
            ->limit(50)
            ->get([
                'customers.id',
                DB::raw("COALESCE(customers.name, 'Publico en general') as name"),
                DB::raw('COUNT(sales.id) as total_sales'),
                DB::raw('SUM(sales.total) as total_revenue'),
            ]);

        return view('admin.reports.top_customers', [
            'from' => $from,
            'to' => $to,
            'rows' => $rows,
        ]);
    }

    public function topSuppliers(Request $request): View
    {
        [$from, $to] = $this->resolveRange($request, days: 180);

        $rows = Purchase::query()
            ->join('suppliers', 'suppliers.id', '=', 'purchases.supplier_id')
            ->where('purchases.status', Purchase::STATUS_RECIBIDA)
            ->whereBetween('purchases.date', [$from, $to])
            ->groupBy('suppliers.id', 'suppliers.name')
            ->orderByDesc(DB::raw('SUM(purchases.total)'))
            ->get([
                'suppliers.id',
                'suppliers.name',
                DB::raw('COUNT(purchases.id) as total_purchases'),
                DB::raw('SUM(purchases.total) as total_spent'),
            ]);

        return view('admin.reports.top_suppliers', [
            'from' => $from,
            'to' => $to,
            'rows' => $rows,
        ]);
    }

    public function deadStock(Request $request): View
    {
        $days = max(1, (int) $request->input('days', 60));
        $cutoff = now()->subDays($days);

        $products = Product::query()
            ->with(['category', 'brand'])
            ->where('active', true)
            ->where('stock', '>', 0)
            ->whereDoesntHave('movements', function ($q) use ($cutoff) {
                $q->where('type', 'salida')->where('created_at', '>=', $cutoff);
            })
            ->orderByDesc('stock')
            ->paginate(30)
            ->withQueryString();

        return view('admin.reports.dead_stock', [
            'products' => $products,
            'days' => $days,
        ]);
    }

    public function dailyCash(Request $request): View
    {
        $day = $request->date('day') ?? today();

        $sessions = CashSession::with(['user'])
            ->where('status', CashSession::STATUS_CERRADA)
            ->whereDate('closed_at', $day)
            ->orderBy('closed_at')
            ->get();

        $totals = [
            'opening' => (float) $sessions->sum('opening_amount'),
            'expected' => (float) $sessions->sum('expected_cash'),
            'counted' => (float) $sessions->sum('counted_cash'),
            'difference' => (float) $sessions->sum('difference'),
        ];

        return view('admin.reports.daily_cash', [
            'day' => $day,
            'sessions' => $sessions,
            'totals' => $totals,
        ]);
    }

    public function inventoryValue(): View
    {
        $rows = Product::query()
            ->with(['category', 'unit'])
            ->where('active', true)
            ->where('stock', '>', 0)
            ->orderByDesc(DB::raw('stock * purchase_price'))
            ->get();

        $totalCostValue = (float) $rows->sum(fn ($p) => (float) $p->stock * (float) $p->purchase_price);
        $totalSaleValue = (float) $rows->sum(fn ($p) => (float) $p->stock * (float) $p->sale_price);
        $potentialProfit = $totalSaleValue - $totalCostValue;

        return view('admin.reports.inventory_value', [
            'rows' => $rows,
            'totalCostValue' => $totalCostValue,
            'totalSaleValue' => $totalSaleValue,
            'potentialProfit' => $potentialProfit,
        ]);
    }

    /**
     * @return array{0:Carbon,1:Carbon}
     */
    private function resolveRange(Request $request, int $days = 30): array
    {
        $from = $request->date('from')?->startOfDay() ?? now()->subDays($days - 1)->startOfDay();
        $to = $request->date('to')?->endOfDay() ?? now()->endOfDay();

        if ($from->gt($to)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }

        return [$from, $to];
    }
}
