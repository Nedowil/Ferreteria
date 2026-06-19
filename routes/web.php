<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\BackupController;
use App\Http\Controllers\Admin\BranchController;
use App\Http\Controllers\Admin\BranchSwitcherController;
use App\Http\Controllers\Admin\BrandController;
use App\Http\Controllers\Admin\CashController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\CompanySettingController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\FelController;
use App\Http\Controllers\Admin\ImportController;
use App\Http\Controllers\Admin\InventoryController;
use App\Http\Controllers\Admin\InvoiceController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\PurchaseController;
use App\Http\Controllers\Admin\QuotationController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\RoleController;
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
        Route::resource('roles', RoleController::class)->except('show');
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
            Route::get('productos/exportar', [ProductController::class, 'export'])->name('productos.export');
            Route::get('productos/{producto}/etiqueta', [ProductController::class, 'label'])->name('productos.label');
            Route::post('productos/{producto}/etiqueta-zpl', [ProductController::class, 'labelZpl'])->name('productos.label_zpl');
            Route::get('inventario/bajo-stock', [InventoryController::class, 'lowStock'])->name('inventario.low_stock');
            Route::get('inventario/{producto}', [InventoryController::class, 'show'])->name('inventario.show');
        });

        Route::middleware('permission:productos.crear')->group(function () {
            Route::get('productos/create', [ProductController::class, 'create'])->name('productos.create');
            Route::post('productos', [ProductController::class, 'store'])->name('productos.store');
            Route::post('productos/quick', [ProductController::class, 'quickStore'])->name('productos.quick');
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
            Route::get('conteo-fisico', [\App\Http\Controllers\Admin\StockCountController::class, 'create'])->name('conteo.create');
            Route::post('conteo-fisico', [\App\Http\Controllers\Admin\StockCountController::class, 'store'])->name('conteo.store');
        });

        // Cuentas por pagar a proveedores
        Route::middleware('permission:compras.ver')->group(function () {
            Route::get('cuentas-pagar', [\App\Http\Controllers\Admin\AccountsPayableController::class, 'index'])->name('cuentas_pagar.index');
            Route::post('cuentas-pagar/{compra}/pagar', [\App\Http\Controllers\Admin\AccountsPayableController::class, 'pay'])->name('cuentas_pagar.pay');
        });

        // Cuentas por cobrar a clientes (creditos)
        Route::middleware('permission:ventas.ver')->group(function () {
            Route::get('cuentas-cobrar', [\App\Http\Controllers\Admin\AccountsReceivableController::class, 'index'])->name('cuentas_cobrar.index');
            Route::post('cuentas-cobrar/{venta}/cobrar', [\App\Http\Controllers\Admin\AccountsReceivableController::class, 'receive'])->name('cuentas_cobrar.receive');
        });

        // Transferencias entre sucursales
        Route::middleware('permission:transferencias.gestionar')->group(function () {
            Route::get('transferencias', [\App\Http\Controllers\Admin\BranchTransferController::class, 'index'])->name('transferencias.index');
            Route::get('transferencias/nueva', [\App\Http\Controllers\Admin\BranchTransferController::class, 'create'])->name('transferencias.create');
            Route::post('transferencias', [\App\Http\Controllers\Admin\BranchTransferController::class, 'store'])->name('transferencias.store');
            Route::get('transferencias/{transferencia}', [\App\Http\Controllers\Admin\BranchTransferController::class, 'show'])->name('transferencias.show');
            Route::post('transferencias/{transferencia}/enviar', [\App\Http\Controllers\Admin\BranchTransferController::class, 'send'])->name('transferencias.send');
            Route::post('transferencias/{transferencia}/recibir', [\App\Http\Controllers\Admin\BranchTransferController::class, 'receive'])->name('transferencias.receive');
            Route::post('transferencias/{transferencia}/cancelar', [\App\Http\Controllers\Admin\BranchTransferController::class, 'cancel'])->name('transferencias.cancel');
        });

        // Pedidos pendientes
        Route::middleware('permission:ventas.ver')->group(function () {
            Route::get('pedidos', [\App\Http\Controllers\Admin\PendingOrderController::class, 'index'])->name('pedidos.index');
            Route::get('pedidos/nuevo', [\App\Http\Controllers\Admin\PendingOrderController::class, 'create'])->name('pedidos.create');
            Route::post('pedidos', [\App\Http\Controllers\Admin\PendingOrderController::class, 'store'])->name('pedidos.store');
            Route::post('pedidos/{pedido}/notificar', [\App\Http\Controllers\Admin\PendingOrderController::class, 'markNotified'])->name('pedidos.notify');
            Route::post('pedidos/{pedido}/entregado', [\App\Http\Controllers\Admin\PendingOrderController::class, 'markDelivered'])->name('pedidos.deliver');
            Route::post('pedidos/{pedido}/cancelar', [\App\Http\Controllers\Admin\PendingOrderController::class, 'cancel'])->name('pedidos.cancel');
        });

        Route::middleware('permission:proveedores.ver')->group(function () {
            Route::get('proveedores/exportar', [SupplierController::class, 'export'])->name('proveedores.export');
            Route::resource('proveedores', SupplierController::class)
                ->except('show')
                ->parameters(['proveedores' => 'proveedor']);
        });

        Route::middleware('permission:compras.ver')->group(function () {
            Route::get('compras', [PurchaseController::class, 'index'])->name('compras.index');
            Route::get('compras/exportar', [PurchaseController::class, 'export'])->name('compras.export');
            Route::get('compras/{compra}/modal', [PurchaseController::class, 'modal'])->name('compras.modal');
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
            Route::get('clientes/exportar', [CustomerController::class, 'export'])->name('clientes.export');
            Route::resource('clientes', CustomerController::class)
                ->except('show')
                ->parameters(['clientes' => 'cliente']);
        });

        Route::middleware('permission:clientes.crear')->group(function () {
            Route::post('clientes/quick', [CustomerController::class, 'quickStore'])->name('clientes.quick');
            Route::get('clientes/lookup-sat', [CustomerController::class, 'lookupSat'])->name('clientes.lookup_sat');
        });

        Route::middleware('permission:ventas.ver')->group(function () {
            Route::get('ventas', [SaleController::class, 'index'])->name('ventas.index');
            Route::get('ventas/exportar', [SaleController::class, 'export'])->name('ventas.export');
            Route::get('ventas/{venta}/modal', [SaleController::class, 'modal'])->name('ventas.modal');
            Route::get('ventas/{venta}', [SaleController::class, 'show'])->name('ventas.show');
            Route::get('ventas/{venta}/ticket', [SaleController::class, 'ticket'])->name('ventas.ticket');
            Route::get('ventas/{venta}/escpos', [SaleController::class, 'escposBytes'])->name('ventas.escpos');
            Route::post('ventas/{venta}/imprimir-red', [SaleController::class, 'printNetwork'])->name('ventas.print_network');
        });

        Route::middleware('permission:ventas.crear')->group(function () {
            Route::get('pos', [SaleController::class, 'pos'])->name('ventas.pos');
            Route::get('pos/productos', [SaleController::class, 'searchProducts'])->name('ventas.search_products');
            Route::post('ventas', [SaleController::class, 'store'])->name('ventas.store');
        });

        Route::middleware('permission:ventas.cancelar')->group(function () {
            Route::post('ventas/{venta}/cancelar', [SaleController::class, 'cancel'])->name('ventas.cancel');
        });

        // Devoluciones (parciales) de venta
        Route::middleware('permission:ventas.ver')->group(function () {
            Route::get('devoluciones', [\App\Http\Controllers\Admin\SaleReturnController::class, 'index'])->name('devoluciones.index');
            Route::get('devoluciones/buscar-venta', [\App\Http\Controllers\Admin\SaleReturnController::class, 'searchSale'])->name('devoluciones.search_sale');
            Route::get('devoluciones/{devolucion}', [\App\Http\Controllers\Admin\SaleReturnController::class, 'show'])->name('devoluciones.show');
        });
        Route::middleware('permission:ventas.cancelar')->group(function () {
            Route::get('devoluciones-nueva', [\App\Http\Controllers\Admin\SaleReturnController::class, 'create'])->name('devoluciones.create');
            Route::post('devoluciones', [\App\Http\Controllers\Admin\SaleReturnController::class, 'store'])->name('devoluciones.store');
            Route::post('devoluciones/{devolucion}/cancelar', [\App\Http\Controllers\Admin\SaleReturnController::class, 'cancel'])->name('devoluciones.cancel');
        });

        Route::middleware('permission:caja.ver')->group(function () {
            Route::get('caja', [CashController::class, 'index'])->name('caja.index');
            Route::get('caja/{caja}/modal', [CashController::class, 'modal'])->name('caja.modal');
            Route::get('caja/{caja}', [CashController::class, 'show'])->name('caja.show');
        });

        Route::middleware('permission:caja.abrir')->group(function () {
            Route::post('caja/abrir', [CashController::class, 'open'])->name('caja.open');
        });

        Route::middleware('permission:caja.movimientos')->group(function () {
            Route::post('caja/{caja}/movimientos', [CashController::class, 'storeMovement'])->name('caja.movimientos.store');
        });

        Route::middleware('permission:caja.cerrar')->group(function () {
            Route::post('caja/{caja}/cerrar', [CashController::class, 'close'])->name('caja.close');
        });

        Route::middleware('permission:configuracion.gestionar')->group(function () {
            Route::get('configuracion/emisor', [CompanySettingController::class, 'edit'])->name('configuracion.empresa.edit');
            Route::put('configuracion/emisor', [CompanySettingController::class, 'update'])->name('configuracion.empresa.update');
        });

        Route::middleware('permission:sucursales.gestionar')->group(function () {
            Route::resource('sucursales', BranchController::class)->parameters(['sucursales' => 'sucursal'])->except('show');
        });
        // Cambio de sucursal disponible para cualquier usuario autenticado
        Route::post('sucursal/cambiar', [BranchSwitcherController::class, 'switch'])->name('sucursal.switch');

        Route::middleware('permission:auditoria.ver')->group(function () {
            Route::get('auditoria/exportar', [AuditLogController::class, 'export'])->name('auditoria.export');
            Route::get('auditoria', [AuditLogController::class, 'index'])->name('auditoria.index');
        });

        Route::middleware('permission:imports.gestionar')->group(function () {
            Route::get('importar', [ImportController::class, 'index'])->name('import.index');
            Route::get('importar/plantilla/{tipo}', [ImportController::class, 'template'])->name('import.template');
            Route::post('importar/clientes', [ImportController::class, 'customers'])->name('import.customers');
            Route::post('importar/productos', [ImportController::class, 'products'])->name('import.products');
            Route::post('importar/ventas', [ImportController::class, 'sales'])->name('import.sales');
        });

        Route::middleware('permission:backup.gestionar')->group(function () {
            Route::get('backups', [BackupController::class, 'index'])->name('backup.index');
            Route::post('backups/run', [BackupController::class, 'run'])->name('backup.run');
            Route::get('backups/{filename}', [BackupController::class, 'download'])->name('backup.download');
            Route::delete('backups/{filename}', [BackupController::class, 'destroy'])->name('backup.destroy');
        });

        Route::middleware('permission:cotizaciones.ver')->group(function () {
            Route::get('cotizaciones', [QuotationController::class, 'index'])->name('cotizaciones.index');
            Route::get('cotizaciones/exportar', [QuotationController::class, 'export'])->name('cotizaciones.export');
            Route::get('cotizaciones/{cotizacion}/modal', [QuotationController::class, 'modal'])->name('cotizaciones.modal');
            Route::get('cotizaciones/{cotizacion}', [QuotationController::class, 'show'])->name('cotizaciones.show');
            Route::get('cotizaciones/{cotizacion}/pdf', [QuotationController::class, 'pdf'])->name('cotizaciones.pdf');
        });

        Route::middleware('permission:cotizaciones.crear')->group(function () {
            Route::get('cotizaciones-nueva', [QuotationController::class, 'create'])->name('cotizaciones.create');
            Route::post('cotizaciones', [QuotationController::class, 'store'])->name('cotizaciones.store');
        });

        Route::middleware('permission:cotizaciones.convertir')->group(function () {
            Route::post('cotizaciones/{cotizacion}/convertir', [QuotationController::class, 'convert'])->name('cotizaciones.convert');
        });

        Route::middleware('permission:cotizaciones.cancelar')->group(function () {
            Route::post('cotizaciones/{cotizacion}/cancelar', [QuotationController::class, 'cancel'])->name('cotizaciones.cancel');
        });

        Route::middleware('permission:ventas.ver')->group(function () {
            Route::get('ventas/{venta}/factura-pdf', [InvoiceController::class, 'simplePdf'])->name('ventas.factura_pdf');
        });

        Route::middleware('permission:facturas.emitir')->group(function () {
            Route::post('ventas/{venta}/fel', [FelController::class, 'emit'])->name('fel.emit');
            Route::post('devoluciones/{devolucion}/fel', [FelController::class, 'emitReturn'])->name('fel.emit_return');
        });

        // Configuracion del certificador FEL (credenciales Infile/Megaprint/etc)
        Route::middleware('permission:configuracion.gestionar')->group(function () {
            Route::get('fel/configuracion', [\App\Http\Controllers\Admin\FelConfigController::class, 'edit'])->name('fel.config.edit');
            Route::put('fel/configuracion', [\App\Http\Controllers\Admin\FelConfigController::class, 'update'])->name('fel.config.update');
            Route::post('fel/configuracion/test', [\App\Http\Controllers\Admin\FelConfigController::class, 'test'])->name('fel.config.test');
        });

        Route::middleware('permission:facturas.ver')->group(function () {
            Route::get('fel', [FelController::class, 'index'])->name('fel.index');
            Route::get('fel/{factura}', [FelController::class, 'show'])->name('fel.show');
            Route::get('fel/{factura}/xml', [FelController::class, 'xml'])->name('fel.xml');
        });

        Route::middleware('permission:facturas.anular')->group(function () {
            Route::post('fel/{factura}/anular', [FelController::class, 'annul'])->name('fel.annul');
        });

        Route::middleware('permission:reportes.ver')
            ->prefix('reportes')
            ->name('reportes.')
            ->group(function () {
                Route::get('/', [ReportController::class, 'index'])->name('index');
                Route::get('ventas', [ReportController::class, 'sales'])->name('sales');
                Route::get('productos-top', [ReportController::class, 'topProducts'])->name('top_products');
                Route::get('utilidad', [ReportController::class, 'profit'])->name('profit');
                Route::get('clientes-top', [ReportController::class, 'topCustomers'])->name('top_customers');
                Route::get('proveedores-top', [ReportController::class, 'topSuppliers'])->name('top_suppliers');
                Route::get('stock-muerto', [ReportController::class, 'deadStock'])->name('dead_stock');
                Route::get('corte-diario', [ReportController::class, 'dailyCash'])->name('daily_cash');
                Route::get('valor-inventario', [ReportController::class, 'inventoryValue'])->name('inventory_value');
            });
    });

// Rutas publicas firmadas para compartir PDFs por WhatsApp/email sin requerir login
Route::get('p/factura/{sale}', [\App\Http\Controllers\Public\PublicDocumentController::class, 'sale'])
    ->name('public.documents.sale')
    ->middleware('signed');
Route::get('p/cotizacion/{quotation}', [\App\Http\Controllers\Public\PublicDocumentController::class, 'quotation'])
    ->name('public.documents.quotation')
    ->middleware('signed');

require __DIR__.'/auth.php';
