<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Precio por contenedor completo (caja, rollo). Puede ser distinto de sale_price * container_factor
            // porque al vender por mayor el precio unitario es menor.
            $table->decimal('container_price', 12, 2)->nullable()->after('container_factor');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('container_price');
        });
    }
};
