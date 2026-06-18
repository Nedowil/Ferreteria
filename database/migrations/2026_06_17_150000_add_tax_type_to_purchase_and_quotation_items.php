<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('purchase_items') && ! Schema::hasColumn('purchase_items', 'tax_type')) {
            Schema::table('purchase_items', function (Blueprint $table) {
                $table->string('tax_type', 20)->default('iva')->after('subtotal');
            });
        }
        // Por si el quotation_items aun no recibio el campo
        if (Schema::hasTable('quotation_items') && ! Schema::hasColumn('quotation_items', 'tax_type')) {
            Schema::table('quotation_items', function (Blueprint $table) {
                $table->string('tax_type', 20)->default('iva')->after('subtotal');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('purchase_items') && Schema::hasColumn('purchase_items', 'tax_type')) {
            Schema::table('purchase_items', function (Blueprint $table) {
                $table->dropColumn('tax_type');
            });
        }
    }
};
