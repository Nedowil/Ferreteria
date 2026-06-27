<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Relacion N:M de productos a productos sustitutos. Cada fila indica
        // que cuando product_id no tiene stock o no se encuentra, substitute_id
        // es una alternativa sugerida.
        Schema::create('product_substitutes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('substitute_id')->constrained('products')->cascadeOnDelete();
            $table->unsignedInteger('priority')->default(1);
            $table->string('note', 120)->nullable();
            $table->timestamps();
            $table->unique(['product_id', 'substitute_id']);
            $table->index(['product_id', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_substitutes');
    }
};
