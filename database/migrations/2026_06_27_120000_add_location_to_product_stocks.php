<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Ubicacion fisica dentro de la sucursal (pasillo, anaquel, columna).
        // La guardamos en product_stocks para que un mismo producto pueda estar
        // en distintas ubicaciones segun la sucursal.
        Schema::table('product_stocks', function (Blueprint $table) {
            $table->string('location', 60)->nullable()->after('min_stock');
        });
    }

    public function down(): void
    {
        Schema::table('product_stocks', function (Blueprint $table) {
            $table->dropColumn('location');
        });
    }
};
