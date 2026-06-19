<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('branch_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('folio', 30)->unique();
            $table->foreignId('from_branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('to_branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete(); // quien creo
            $table->foreignId('sent_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('date');
            $table->dateTime('sent_at')->nullable();
            $table->dateTime('received_at')->nullable();
            // pendiente | en_transito | recibida | cancelada
            $table->string('status', 20)->default('pendiente');
            $table->text('notes')->nullable();
            $table->text('reason_cancelled')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'date']);
        });

        Schema::create('branch_transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_transfer_id')->constrained('branch_transfers')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            // cantidad en unidad BASE (ya con units_factor aplicado)
            $table->decimal('quantity_base', 12, 4);
            // cantidad como la ingreso el usuario (puede ser en cajas o en libras)
            $table->decimal('quantity_input', 12, 4);
            $table->string('unit_label', 30)->nullable();
            $table->decimal('units_factor', 12, 4)->default(1);
            $table->timestamps();

            $table->index('branch_transfer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_transfer_items');
        Schema::dropIfExists('branch_transfers');
    }
};
