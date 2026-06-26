<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->boolean('public_catalog_enabled')->default(false)->after('phrases');
            $table->boolean('public_catalog_show_prices')->default(true)->after('public_catalog_enabled');
            $table->string('public_catalog_title', 180)->nullable()->after('public_catalog_show_prices');
            $table->text('public_catalog_intro')->nullable()->after('public_catalog_title');
            $table->string('public_catalog_whatsapp', 30)->nullable()->after('public_catalog_intro');
        });

        Schema::table('products', function (Blueprint $table) {
            // Permitir esconder productos especificos del catalogo publico aunque
            // esten activos. Por defecto todos los activos son visibles.
            $table->boolean('public_visible')->default(true)->after('active');
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn([
                'public_catalog_enabled',
                'public_catalog_show_prices',
                'public_catalog_title',
                'public_catalog_intro',
                'public_catalog_whatsapp',
            ]);
        });
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('public_visible');
        });
    }
};
