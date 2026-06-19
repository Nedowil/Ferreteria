<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->string('payment_status', 20)->default('pagada')->after('status'); // pagada|al_credito|parcial
            $table->decimal('amount_paid', 12, 2)->default(0)->after('payment_status');
            $table->date('due_date')->nullable()->after('amount_paid');
        });

        Schema::create('purchase_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained('purchases')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('date');
            $table->decimal('amount', 12, 2);
            $table->string('payment_method', 30)->default('efectivo');
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('purchase_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_payments');
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropColumn(['payment_status', 'amount_paid', 'due_date']);
        });
    }
};
