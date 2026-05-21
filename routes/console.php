<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Backup automatico diario a las 2:30 am, conservando los ultimos 14 dias
Schedule::command('backup:run --keep=14')
    ->dailyAt('02:30')
    ->onOneServer()
    ->withoutOverlapping();
