<?php

namespace App\Infrastructure\Persistence\Eloquent;

use Illuminate\Database\Eloquent\Model;

class CompanyModel extends Model
{
    protected $table = 'companies';

    protected $fillable = [
        'code',
        'name',
        'logo',
        'valuation',
        'registry_address',
        'governance_address',
        'token_address',
        'treasury_address',
        'funding_address',
        'distribution_address',
        'marketplace_address',
        'oracle_address',
        'status',
    ];

    protected $casts = [
        'valuation' => 'float',
    ];
}
