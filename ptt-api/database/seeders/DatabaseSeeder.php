<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Eloquent\UserModel;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        UserModel::factory()->create([
            'name' => 'User-d35555',
            'email' => 'user-d35555@ptt-web3.com',
            'wallet_address' => '0x75AD18eF47eDa21Baff837CAC0f1563D0C35555',
        ]);
    }
}
