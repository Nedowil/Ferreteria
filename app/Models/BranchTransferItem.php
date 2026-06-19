<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BranchTransferItem extends Model
{
    protected $fillable = [
        'branch_transfer_id',
        'product_id',
        'quantity_base',
        'quantity_input',
        'unit_label',
        'units_factor',
    ];

    protected $casts = [
        'quantity_base' => 'decimal:4',
        'quantity_input' => 'decimal:4',
        'units_factor' => 'decimal:4',
    ];

    public function transfer(): BelongsTo
    {
        return $this->belongsTo(BranchTransfer::class, 'branch_transfer_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
