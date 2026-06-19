<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Costo unitario capturado AL MOMENTO de la venta para reportes precisos
        // a largo plazo. Si en el futuro el precio de compra del producto cambia,
        // los reportes historicos NO se distorsionan.
        // Almacena el costo total por unidad VENDIDA (ya incluye units_factor).
        // Ej: 1 caja con factor 50 y purchase_price Q9/lb -> unit_cost = Q450
        Schema::table('sale_items', function (Blueprint $table) {
            $table->decimal('unit_cost', 12, 4)->nullable()->after('unit_price');
        });
        Schema::table('sale_return_items', function (Blueprint $table) {
            $table->decimal('unit_cost', 12, 4)->nullable()->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropColumn('unit_cost');
        });
        Schema::table('sale_return_items', function (Blueprint $table) {
            $table->dropColumn('unit_cost');
        });
    }
};
