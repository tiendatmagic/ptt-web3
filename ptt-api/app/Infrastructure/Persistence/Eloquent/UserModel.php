<?php

namespace App\Infrastructure\Persistence\Eloquent;

use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class UserModel extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'users';

    protected $fillable = [
        'name',
        'wallet_address',
        'email',
        'phone',
        'address',
        'password',
        'kyc_status',
        'is_whitelisted',
        'is_blacklisted',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_whitelisted' => 'boolean',
            'is_blacklisted' => 'boolean',
        ];
    }

    protected static function newFactory()
    {
        return \Database\Factories\UserFactory::new();
    }
}
