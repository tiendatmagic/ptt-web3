<?php

namespace App\Providers;

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
        if (request()->hasCookie('auth_token')) {
            request()->headers->set('Authorization', 'Bearer ' . request()->cookie('auth_token'));
        }
    }
}
