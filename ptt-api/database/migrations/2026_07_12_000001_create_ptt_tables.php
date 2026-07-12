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
        // 1. Companies table
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('logo')->nullable();
            $table->decimal('valuation', 24, 4)->default(0);
            $table->string('governance_address', 42)->nullable();
            $table->string('token_address', 42)->nullable();
            $table->string('funding_address', 42)->nullable();
            $table->string('marketplace_address', 42)->nullable();
            $table->string('status')->default('ACTIVE'); // ACTIVE, SUSPENDED
            $table->timestamps();
        });

        // 2. Roles table (Scoped to company, or NULL for platform super admin)
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->nullable()->constrained('companies')->onDelete('cascade');
            $table->string('name'); // e.g. CEO, CFO, Accountant, Board Member
            $table->json('permissions');
            $table->timestamps();
        });

        // 3. Staffs table (Links user to company and role)
        Schema::create('staffs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
            $table->string('status')->default('ACTIVE'); // ACTIVE, INACTIVE
            $table->timestamps();
        });

        // 4. Proposals table (Governance)
        Schema::create('proposals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('type'); // e.g. MINT, BURN, WITHDRAW, DIVIDEND, FUNDING_ROUND, CONFIG
            $table->json('params')->nullable(); // Target address, value, calldata params
            $table->string('status')->default('DRAFT'); // DRAFT, PENDING, APPROVED, EXECUTED, REJECTED, CANCELLED
            $table->string('tx_hash')->nullable();
            $table->timestamp('effective_date')->nullable();
            $table->timestamp('expiration_date')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            $table->index(['company_id', 'status']);
        });

        // 5. Proposal Signatures table (Board members voting/signing)
        Schema::create('proposal_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('proposal_id')->constrained('proposals')->onDelete('cascade');
            $table->string('wallet_address', 42);
            $table->text('signature'); // EIP-712 Signature
            $table->string('status')->default('SIGNED'); // SIGNED, REJECTED
            $table->timestamps();
        });

        // 6. Funding Rounds table
        Schema::create('funding_rounds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('name'); // e.g. Seed, Series A
            $table->decimal('share_price', 24, 4);
            $table->decimal('target_amount', 24, 4);
            $table->decimal('raised_amount', 24, 4)->default(0);
            $table->timestamp('start_date')->nullable();
            $table->timestamp('end_date')->nullable();
            $table->string('status')->default('DRAFT'); // DRAFT, ACTIVE, COMPLETED, CANCELLED
            $table->timestamps();
        });

        // 7. Dividends table
        Schema::create('dividends', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('reward_token_address')->nullable(); // Address(0) for native token, or ERC20 address
            $table->decimal('total_amount', 24, 4);
            $table->unsignedBigInteger('snapshot_block');
            $table->timestamp('payment_date')->nullable();
            $table->string('status')->default('DRAFT'); // DRAFT, APPROVED, ACTIVE, FINISHED, CANCELLED
            $table->timestamps();
        });

        // 8. Orders table (Off-chain Order Book)
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->onDelete('cascade');
            $table->string('user_address', 42);
            $table->string('side'); // BUY, SELL
            $table->decimal('price', 24, 4);
            $table->decimal('amount', 24, 4);
            $table->decimal('filled_amount', 24, 4)->default(0);
            $table->text('signature'); // EIP-712 signature from investor approving order matching
            $table->string('status')->default('PENDING'); // PENDING, FILLED, PARTIALLY_FILLED, CANCELLED
            $table->timestamps();

            $table->index(['company_id', 'side', 'status']);
        });

        // 9. Trades table (Matched Trades History)
        Schema::create('trades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('buy_order_id')->constrained('orders')->onDelete('cascade');
            $table->foreignId('sell_order_id')->constrained('orders')->onDelete('cascade');
            $table->decimal('price', 24, 4);
            $table->decimal('amount', 24, 4);
            $table->string('tx_hash'); // On-chain Settlement Tx Hash
            $table->timestamps();

            $table->index('tx_hash');
        });

        // 10. Audit Logs table
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('wallet_address', 42)->nullable();
            $table->string('action');
            $table->text('details')->nullable();
            $table->string('ip_address')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('trades');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('dividends');
        Schema::dropIfExists('funding_rounds');
        Schema::dropIfExists('proposal_signatures');
        Schema::dropIfExists('proposals');
        Schema::dropIfExists('staffs');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('companies');
    }
};
