<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->string('printer_mode', 20)->default('system')->after('phrases'); // system|bluetooth|network
            $table->string('printer_ip', 45)->nullable()->after('printer_mode');
            $table->unsignedSmallInteger('printer_port')->default(9100)->after('printer_ip');
            $table->unsignedSmallInteger('printer_width')->default(80)->after('printer_port'); // mm: 58 o 80
            $table->boolean('printer_auto_cut')->default(true)->after('printer_width');
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn(['printer_mode', 'printer_ip', 'printer_port', 'printer_width', 'printer_auto_cut']);
        });
    }
};
