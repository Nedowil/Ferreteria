<?php

namespace App\Providers;

use App\Services\Fel\FelCertificadorInterface;
use App\Services\Fel\FelSoapCertificador;
use App\Services\Fel\FelStubCertificador;
use App\Services\Fel\InfileCertificador;
use Illuminate\Support\ServiceProvider;

class FelServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(FelCertificadorInterface::class, function () {
            return match (config('fel.driver', 'stub')) {
                'infile' => new InfileCertificador(),
                'soap' => new FelSoapCertificador(),
                default => new FelStubCertificador(),
            };
        });
    }

    public function boot(): void
    {
    }
}
