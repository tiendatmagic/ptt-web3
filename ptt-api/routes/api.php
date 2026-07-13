<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\v1\AuthController;
use App\Http\Controllers\Api\v1\CompanyController;
use App\Http\Controllers\Api\v1\StaffController;
use App\Http\Controllers\Api\v1\UserController;
use App\Http\Controllers\Api\v1\ProposalController;
use App\Http\Controllers\Api\v1\MarketplaceController;
use App\Http\Controllers\Api\v1\FundingDividendController;

Route::prefix('v1')->middleware('throttle:api')->group(function () {
    // Authentication Routes — rate limited to prevent brute-force
    Route::prefix('auth')->group(function () {
        Route::get('challenge', [AuthController::class, 'challenge'])->middleware('throttle:auth');
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:auth');
        Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
        Route::get('me', [AuthController::class, 'me'])->middleware('auth:sanctum');
    });

    // Company Routes
    Route::prefix('companies')->group(function () {
        Route::get('/', [CompanyController::class, 'index']);
        Route::get('{code}', [CompanyController::class, 'show']);
        Route::post('register', [CompanyController::class, 'register'])->middleware('auth:sanctum');
        Route::put('{id}/contracts', [CompanyController::class, 'updateContracts'])->middleware('auth:sanctum');
        Route::put('{id}', [CompanyController::class, 'update'])->middleware('auth:sanctum');
        Route::delete('{id}', [CompanyController::class, 'destroy'])->middleware('auth:sanctum');
    });

    Route::post('contracts/verify', [CompanyController::class, 'verifyContract'])->middleware('auth:sanctum');

    // Marketplace Public Routes
    Route::prefix('marketplace')->group(function () {
        Route::get('orderbook', [MarketplaceController::class, 'orderBook']);
        Route::get('trades', [MarketplaceController::class, 'tradeHistory']);
    });

    // Funding & Dividend Public Routes
    Route::get('funding', [FundingDividendController::class, 'indexFunding']);
    Route::get('dividends', [FundingDividendController::class, 'indexDividends']);

    // Staff & Roles Routes (Requires Authentication & Permissions)
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('staffs', [StaffController::class, 'index'])->middleware('permission:staffs.view');
        Route::post('staffs', [StaffController::class, 'store'])->middleware('permission:staffs.create');
        Route::delete('staffs/{id}', [StaffController::class, 'destroy'])->middleware('permission:staffs.edit');
        Route::get('roles', [StaffController::class, 'indexRoles'])->middleware('permission:staffs.view');
    });

    // Public Proposal Routes
    Route::prefix('proposals')->group(function () {
        Route::get('/', [ProposalController::class, 'index']);
        Route::get('{id}', [ProposalController::class, 'show']);
    });

    // Proposal Protected Routes (Requires Authentication & Permissions)
    Route::middleware('auth:sanctum')->prefix('proposals')->group(function () {
        Route::post('/', [ProposalController::class, 'store'])->middleware('permission:proposals.create');
        Route::post('{id}/sign', [ProposalController::class, 'sign'])->middleware('permission:proposals.sign');
        Route::post('{id}/execute', [ProposalController::class, 'execute'])->middleware('permission:proposals.execute');
    });

    // Marketplace Protected Routes
    Route::middleware('auth:sanctum')->prefix('marketplace')->group(function () {
        Route::post('orders', [MarketplaceController::class, 'placeOrder']);
        Route::post('orders/{id}/cancel', [MarketplaceController::class, 'cancelOrder']);
        Route::post('trades/settle', [MarketplaceController::class, 'settleTrade']);
    });

    // Funding & Dividend Protected Routes (Requires Authentication & Permissions)
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('funding', [FundingDividendController::class, 'storeFunding'])->middleware('permission:funding.view');
        Route::post('funding/{id}/sync', [FundingDividendController::class, 'syncFunding'])->middleware('permission:funding.view');
        Route::post('dividends', [FundingDividendController::class, 'storeDividend'])->middleware('permission:dividends.create');
        Route::post('dividends/{id}/sync', [FundingDividendController::class, 'syncDividend'])->middleware('permission:dividends.execute');
    });

    // User & KYC Routes (Requires Authentication)
    Route::middleware('auth:sanctum')->prefix('users')->group(function () {
        Route::post('profile', [UserController::class, 'updateProfile']);
        Route::post('kyc/request', [UserController::class, 'requestKyc']);
        
        // System admin kyc approval routes (For simplicity, we protect with permission:staffs.edit on company basis, or simple auth for platform admin)
        Route::get('kyc', [UserController::class, 'indexKyc'])->middleware('permission:staffs.edit');
        Route::post('kyc/batch-sync', [UserController::class, 'batchSyncKyc'])->middleware('permission:staffs.edit');
        Route::post('kyc/{id}/approve', [UserController::class, 'approveKyc'])->middleware('permission:staffs.edit');
        Route::post('kyc/{id}/reject', [UserController::class, 'rejectKyc'])->middleware('permission:staffs.edit');
    });
});
