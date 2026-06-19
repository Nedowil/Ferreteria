<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Precio mayorista por unidad base (libra, metro, etc)
            $table->decimal('wholesale_price', 12, 2)->nullable()->after('sale_price');
            // Cantidad minima en unidad base para que aplique el precio mayorista automaticamente
            $table->decimal('wholesale_min_quantity', 12, 2)->nullable()->after('wholesale_price');
            // Precio mayorista por empaque (caja entera, rollo entero)
            $table->decimal('container_wholesale_price', 12, 2)->nullable()->after('container_price');
        });

        Schema::table('customers', function (Blueprint $table) {
            // 'retail' = minorista (consumidor final), 'wholesale' = mayorista (revende, construye, etc)
            $table->string('customer_type', 20)->default('retail')->after('active');
            // Descuento adicional opcional para clientes mayoristas VIP (sobre el precio mayorista)
            $table->decimal('wholesale_discount_percent', 5, 2)->nullable()->after('customer_type');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['wholesale_price', 'wholesale_min_quantity', 'container_wholesale_price']);
        });
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['customer_type', 'wholesale_discount_percent']);
        });
    }
};
