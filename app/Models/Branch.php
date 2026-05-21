<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Branch extends Model
{
    use Auditable;

    protected $fillable = [
        'name',
        'code',
        'address',
        'phone',
        'email',
        'is_main',
        'active',
    ];

    protected $casts = [
        'is_main' => 'boolean',
        'active' => 'boolean',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'branch_user')->withPivot('is_default')->withTimestamps();
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function productStocks(): HasMany
    {
        return $this->hasMany(ProductStock::class);
    }

    public static function default(): ?self
    {
        return static::where('is_main', true)->where('active', true)->first()
            ?? static::where('active', true)->orderBy('id')->first();
    }
}
