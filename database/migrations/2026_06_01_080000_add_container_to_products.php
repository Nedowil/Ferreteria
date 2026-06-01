<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Unidad base: la mas pequena en la que se mide el stock (libra, onza, metro, unidad...)
            $table->string('base_unit_label', 30)->default('unidad')->after('unit_id');
            // Empaque/contenedor (opcional): caja, rollo, fardo, bulto, saco...
            $table->string('container_label', 30)->nullable()->after('base_unit_label');
            // Cuantas unidades base trae 1 contenedor (50 libras por caja, 100 metros por rollo, 16 onzas por caja)
            $table->decimal('container_factor', 12, 4)->nullable()->after('container_label');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['base_unit_label', 'container_label', 'container_factor']);
        });
    }
};
