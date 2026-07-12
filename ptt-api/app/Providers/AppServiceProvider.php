<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            \App\Domain\Repositories\CompanyRepositoryInterface::class,
            \App\Infrastructure\Persistence\Repositories\CompanyRepository::class
        );
        $this->app->bind(
            \App\Domain\Repositories\UserRepositoryInterface::class,
            \App\Infrastructure\Persistence\Repositories\UserRepository::class
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * Configure rate limiters for the application.
     */
    protected function configureRateLimiting(): void
    {
        // Auth rate limiter: 5 lần / 10 giây per IP + wallet address
        // Dùng Limit constructor (key, maxAttempts, decaySeconds) — tương thích mọi Laravel version
        RateLimiter::for('auth', function (Request $request) {
            $key = $request->ip() . '|' . strtolower((string) $request->input('address', ''));
            return (new Limit($key, 5, 10))->response(function () {
                return response()->json([
                    'message' => 'Too many authentication attempts. Please wait before trying again.',
                ], 429);
            });
        });

        // API rate limiter: 30 lần / 10 giây per authenticated user hoặc IP
        RateLimiter::for('api', function (Request $request) {
            $key = $request->user()?->id ?? $request->ip();
            return (new Limit($key, 30, 10))->response(function () {
                return response()->json([
                    'message' => 'Too many requests. Please slow down.',
                ], 429);
            });
        });
    }
}
