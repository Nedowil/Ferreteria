<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('box_label', 30)->nullable()->after('sale_price');
            $table->decimal('box_price', 12, 2)->nullable()->after('box_label');
            $table->decimal('box_factor', 10, 2)->default(1)->after('box_price');
        });

        Schema::table('sale_items', function (Blueprint $table) {
            $table->string('unit_label', 30)->nullable()->after('subtotal');
            $table->decimal('units_factor', 10, 2)->default(1)->after('unit_label');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['box_label', 'box_price', 'box_factor']);
        });
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropColumn(['unit_label', 'units_factor']);
        });
    }
};
