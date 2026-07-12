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
        Schema::table('funding_rounds', function (Blueprint $table) {
            $table->string('payment_token_address')->nullable()->after('share_price');
            $table->string('payment_token_symbol')->default('BNB')->after('payment_token_address');
            $table->integer('payment_token_decimals')->default(18)->after('payment_token_symbol');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('funding_rounds', function (Blueprint $table) {
            $table->dropColumn(['payment_token_address', 'payment_token_symbol', 'payment_token_decimals']);
        });
    }
};
