<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_presentations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('label', 30);                      // "Libra", "Media libra", "Caja", "Rollo"...
            $table->decimal('units_factor', 10, 4);            // unidades base por cada presentacion (0.5, 1, 10, 100, etc)
            $table->decimal('price', 12, 2);                   // precio de venta de esta presentacion
            $table->unsignedSmallInteger('display_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->index('product_id');
        });

        // Migrar las cajas existentes a la nueva tabla
        if (Schema::hasColumn('products', 'box_label')) {
            DB::table('products')
                ->whereNotNull('box_label')
                ->whereNotNull('box_price')
                ->where('box_factor', '>', 1)
                ->orderBy('id')
                ->each(function ($p) {
                    DB::table('product_presentations')->insert([
                        'product_id' => $p->id,
                        'label' => $p->box_label,
                        'units_factor' => $p->box_factor,
                        'price' => $p->box_price,
                        'display_order' => 1,
                        'active' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                });

            // Eliminar las columnas viejas
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn(['box_label', 'box_price', 'box_factor']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_presentations');
        Schema::table('products', function (Blueprint $table) {
            $table->string('box_label', 30)->nullable();
            $table->decimal('box_price', 12, 2)->nullable();
            $table->decimal('box_factor', 10, 2)->default(1);
        });
    }
};
