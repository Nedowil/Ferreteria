<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('electronic_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->unique()->constrained('sales')->cascadeOnDelete();
            $table->string('document_type', 10)->default('FACT')->comment('FACT|FCAM|NCRE|NDEB|FPEQ');
            $table->string('certificador')->nullable()->comment('Nombre del certificador SAT');
            $table->string('environment', 20)->default('PRUEBAS')->comment('PRUEBAS|PRODUCCION');
            $table->string('serie')->nullable();
            $table->string('numero')->nullable();
            $table->string('uuid')->nullable()->unique()->comment('Numero de autorizacion SAT');
            $table->dateTime('fecha_certificacion')->nullable();
            $table->longText('xml_generated')->nullable()->comment('XML generado antes de certificar');
            $table->longText('xml_signed')->nullable()->comment('XML firmado devuelto por el certificador');
            $table->json('response_payload')->nullable();
            $table->enum('status', ['pendiente', 'certificada', 'anulada', 'error'])->default('pendiente');
            $table->string('error_message', 500)->nullable();
            $table->dateTime('anulada_at')->nullable();
            $table->string('anulacion_uuid')->nullable();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('electronic_invoices');
    }
};
