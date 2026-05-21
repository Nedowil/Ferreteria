<?php

namespace App\Providers;

use App\Services\Fel\FelCertificadorInterface;
use App\Services\Fel\FelSoapCertificador;
use App\Services\Fel\FelStubCertificador;
use Illuminate\Support\ServiceProvider;

class FelServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(FelCertificadorInterface::class, function () {
            return match (config('fel.driver', 'stub')) {
                'soap' => new FelSoapCertificador(),
                default => new FelStubCertificador(),
            };
        });
    }

    public function boot(): void
    {
    }
}
