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
            $table->unsignedBigInteger('onchain_round_id')->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('funding_rounds', function (Blueprint $table) {
            $table->dropColumn('onchain_round_id');
        });
    }
};
