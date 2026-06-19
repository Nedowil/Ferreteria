<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pending_orders', function (Blueprint $table) {
            $table->id();
            $table->string('folio', 30)->unique();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('customer_name')->nullable(); // si no se registra como cliente
            $table->string('customer_phone', 30)->nullable();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('product_description'); // descripcion libre por si el producto no existe aun
            $table->decimal('quantity', 12, 4);
            $table->string('unit_label', 30)->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('pendiente'); // pendiente|notificado|entregado|cancelado
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->dateTime('notified_at')->nullable();
            $table->dateTime('delivered_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_orders');
    }
};
