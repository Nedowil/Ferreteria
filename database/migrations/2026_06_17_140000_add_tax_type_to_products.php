<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Tipo de impuesto del producto para FEL Guatemala.
            // 'iva' = gravado con IVA (usa company.default_tax_rate, default 12%)
            // 'exento' = exento de IVA (no se cobra impuesto)
            $table->string('tax_type', 20)->default('iva')->after('container_price');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('tax_type');
        });
    }
};
