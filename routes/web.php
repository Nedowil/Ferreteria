<?php

use App\Http\Controllers\Admin\BrandController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\InventoryController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\PurchaseController;
use App\Http\Controllers\Admin\SaleController;
use App\Http\Controllers\Admin\SupplierController;
use App\Http\Controllers\Admin\UnitController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware(['auth', 'verified', 'role:admin'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::resource('usuarios', UserController::class)->except('show');
    });

Route::middleware(['auth', 'verified'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::middleware('permission:catalogos.gestionar')->group(function () {
            Route::resource('categorias', CategoryController::class)->except('show')->parameters(['categorias' => 'categoria']);
            Route::resource('marcas', BrandController::class)->except('show')->parameters(['marcas' => 'marca']);
            Route::resource('unidades', UnitController::class)->except('show')->parameters(['unidades' => 'unidad']);
        });

        Route::middleware('permission:productos.ver')->group(function () {
            Route::get('productos', [ProductController::class, 'index'])->name('productos.index');
            Route::get('inventario/bajo-stock', [InventoryController::class, 'lowStock'])->name('inventario.low_stock');
            Route::get('inventario/{producto}', [InventoryController::class, 'show'])->name('inventario.show');
        });

        Route::middleware('permission:productos.crear')->group(function () {
            Route::get('productos/create', [ProductController::class, 'create'])->name('productos.create');
            Route::post('productos', [ProductController::class, 'store'])->name('productos.store');
        });

        Route::middleware('permission:productos.editar')->group(function () {
            Route::get('productos/{producto}/edit', [ProductController::class, 'edit'])->name('productos.edit');
            Route::match(['put', 'patch'], 'productos/{producto}', [ProductController::class, 'update'])->name('productos.update');
        });

        Route::middleware('permission:productos.eliminar')->group(function () {
            Route::delete('productos/{producto}', [ProductController::class, 'destroy'])->name('productos.destroy');
        });

        Route::middleware('permission:inventario.ajustar')->group(function () {
            Route::post('inventario/{producto}/movimientos', [InventoryController::class, 'store'])->name('inventario.movimientos.store');
        });

        Route::middleware('permission:proveedores.ver')->group(function () {
            Route::resource('proveedores', SupplierController::class)
                ->except('show')
                ->parameters(['proveedores' => 'proveedor']);
        });

        Route::middleware('permission:compras.ver')->group(function () {
            Route::get('compras', [PurchaseController::class, 'index'])->name('compras.index');
            Route::get('compras/{compra}', [PurchaseController::class, 'show'])->name('compras.show');
        });

        Route::middleware('permission:compras.crear')->group(function () {
            Route::get('compras-nueva', [PurchaseController::class, 'create'])->name('compras.create');
            Route::post('compras', [PurchaseController::class, 'store'])->name('compras.store');
        });

        Route::middleware('permission:compras.recibir')->group(function () {
            Route::post('compras/{compra}/recibir', [PurchaseController::class, 'receive'])->name('compras.receive');
        });

        Route::middleware('permission:compras.cancelar')->group(function () {
            Route::post('compras/{compra}/cancelar', [PurchaseController::class, 'cancel'])->name('compras.cancel');
        });

        Route::middleware('permission:clientes.ver')->group(function () {
            Route::resource('clientes', CustomerController::class)
                ->except('show')
                ->parameters(['clientes' => 'cliente']);
        });

        Route::middleware('permission:ventas.ver')->group(function () {
            Route::get('ventas', [SaleController::class, 'index'])->name('ventas.index');
            Route::get('ventas/{venta}', [SaleController::class, 'show'])->name('ventas.show');
            Route::get('ventas/{venta}/ticket', [SaleController::class, 'ticket'])->name('ventas.ticket');
        });

        Route::middleware('permission:ventas.crear')->group(function () {
            Route::get('pos', [SaleController::class, 'pos'])->name('ventas.pos');
            Route::get('pos/productos', [SaleController::class, 'searchProducts'])->name('ventas.search_products');
            Route::post('ventas', [SaleController::class, 'store'])->name('ventas.store');
        });

        Route::middleware('permission:ventas.cancelar')->group(function () {
            Route::post('ventas/{venta}/cancelar', [SaleController::class, 'cancel'])->name('ventas.cancel');
        });
    });

require __DIR__.'/auth.php';
