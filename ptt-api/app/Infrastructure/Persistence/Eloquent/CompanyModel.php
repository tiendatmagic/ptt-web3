<?php

namespace App\Infrastructure\Persistence\Eloquent;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Support\Str;

class CompanyModel extends Model
{
    use HasUuids;

    protected $table = 'companies';

    protected $fillable = [
        'uuid',
        'code',
        'name',
        'logo',
        'valuation',
        'governance_address',
        'token_address',
        'funding_address',
        'marketplace_address',
        'token_name',
        'token_symbol',
        'status',
    ];

    protected $casts = [
        'valuation' => 'float',
    ];

    /**
     * Define the columns that should be treated as UUIDs.
     */
    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    /**
     * Generate a new UUID v7 for the model.
     */
    public function newUniqueId(): string
    {
        return (string) Str::uuid7();
    }
}
