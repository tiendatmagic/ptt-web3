<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_token_address', 42)->nullable()->after('amount');
            $table->string('payment_token_symbol', 50)->default('USDT')->after('payment_token_address');
        });

        Schema::table('trades', function (Blueprint $table) {
            $table->string('payment_token_address', 42)->nullable()->after('amount');
            $table->string('payment_token_symbol', 50)->default('USDT')->after('payment_token_address');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['payment_token_address', 'payment_token_symbol']);
        });

        Schema::table('trades', function (Blueprint $table) {
            $table->dropColumn(['payment_token_address', 'payment_token_symbol']);
        });
    }
};
