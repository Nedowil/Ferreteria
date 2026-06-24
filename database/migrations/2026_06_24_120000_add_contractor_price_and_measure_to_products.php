<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('contractor_price', 12, 2)->nullable()->after('wholesale_min_quantity');
            $table->decimal('container_contractor_price', 12, 2)->nullable()->after('container_wholesale_price');
            $table->boolean('sells_by_measure')->default(false)->after('min_stock');
            $table->decimal('measure_step', 12, 4)->nullable()->after('sells_by_measure');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'contractor_price',
                'container_contractor_price',
                'sells_by_measure',
                'measure_step',
            ]);
        });
    }
};
