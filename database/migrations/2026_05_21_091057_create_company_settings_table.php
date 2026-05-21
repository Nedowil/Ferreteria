<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_settings', function (Blueprint $table) {
            $table->id();
            $table->string('commercial_name');
            $table->string('legal_name')->nullable();
            $table->string('tax_id', 30)->comment('NIT del emisor');
            $table->string('tax_regime')->default('PEQUENO_CONTRIBUYENTE')->comment('PEQUENO_CONTRIBUYENTE | GENERAL');
            $table->string('address')->nullable();
            $table->string('department')->nullable();
            $table->string('municipality')->nullable();
            $table->string('postal_code', 10)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->string('logo_path')->nullable();
            $table->string('country_code', 3)->default('GT');
            $table->string('currency_code', 3)->default('GTQ');
            $table->decimal('default_tax_rate', 5, 2)->default(12.00)->comment('IVA % por defecto');
            $table->boolean('prices_include_tax')->default(true);
            $table->json('phrases')->nullable()->comment('Frases SAT del DTE');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_settings');
    }
};
