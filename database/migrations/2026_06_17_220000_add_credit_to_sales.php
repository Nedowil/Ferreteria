<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('payment_status', 20)->default('pagada')->after('status'); // pagada|al_credito|parcial
            $table->date('due_date')->nullable()->after('payment_status');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->decimal('credit_limit', 12, 2)->nullable()->after('wholesale_discount_percent');
            $table->boolean('credit_enabled')->default(false)->after('credit_limit');
        });

        Schema::create('sale_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('date');
            $table->decimal('amount', 12, 2);
            $table->string('payment_method', 30)->default('efectivo');
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('sale_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_payments');
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['credit_limit', 'credit_enabled']);
        });
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['payment_status', 'due_date']);
        });
    }
};
