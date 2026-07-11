<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add Web3 wallet authentication and KYC fields to the users table.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Make password nullable since Web3 users authenticate via wallet signature
            $table->string('password')->nullable()->change();

            // Ethereum wallet address (checksummed lowercase)
            $table->string('wallet_address', 42)->nullable()->unique()->after('email');

            // KYC verification status
            $table->enum('kyc_status', ['PENDING', 'APPROVED', 'REJECTED'])
                  ->default('PENDING')
                  ->after('wallet_address');

            // Whether the wallet address has been whitelisted on EquityToken smart contract
            $table->boolean('is_whitelisted')->default(false)->after('kyc_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['wallet_address', 'kyc_status', 'is_whitelisted']);
            $table->string('password')->nullable(false)->change();
        });
    }
};
