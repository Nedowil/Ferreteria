<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->string('zebra_mode', 20)->default('system')->after('printer_auto_cut'); // system|network
            $table->string('zebra_ip', 45)->nullable()->after('zebra_mode');
            $table->unsignedSmallInteger('zebra_port')->default(9100)->after('zebra_ip');
            $table->unsignedSmallInteger('zebra_label_width')->default(50)->after('zebra_port'); // mm
            $table->unsignedSmallInteger('zebra_label_height')->default(25)->after('zebra_label_width'); // mm
            $table->unsignedSmallInteger('zebra_dpi')->default(203)->after('zebra_label_height'); // 203 o 300
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn(['zebra_mode', 'zebra_ip', 'zebra_port', 'zebra_label_width', 'zebra_label_height', 'zebra_dpi']);
        });
    }
};
