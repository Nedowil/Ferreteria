<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Permitir devoluciones SIN venta de origen ("sin ticket"). Cuando el
        // cliente no trae el comprobante, igual queremos restituir stock y
        // registrar el reintegro con trazabilidad — sale_id queda en null y
        // reason_type = 'sin_ticket'.
        Schema::table('sale_returns', function (Blueprint $table) {
            $table->foreignId('sale_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('sale_returns', function (Blueprint $table) {
            $table->foreignId('sale_id')->nullable(false)->change();
        });
    }
};
