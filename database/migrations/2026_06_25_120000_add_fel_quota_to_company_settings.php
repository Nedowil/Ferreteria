<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            // Cupo anual de DTEs contratado al certificador FEL (0 = sin limite)
            $table->unsignedInteger('fel_yearly_quota')->default(0)->after('phrases');
            // Mes/dia en que reinicia el ciclo del bolson (por defecto 1 de enero)
            $table->unsignedTinyInteger('fel_cycle_month')->default(1)->after('fel_yearly_quota');
            $table->unsignedTinyInteger('fel_cycle_day')->default(1)->after('fel_cycle_month');
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn(['fel_yearly_quota', 'fel_cycle_month', 'fel_cycle_day']);
        });
    }
};
