<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Prepend HandleCors to run FIRST before any other middleware (critical for CORS preflight)
        $middleware->prepend(\Illuminate\Http\Middleware\HandleCors::class);

        // Add security headers to all responses
        $middleware->append(\App\Http\Middleware\SecurityHeadersMiddleware::class);

        // Exclude ALL api/* routes from CSRF verification.
        // Our API uses token-based auth (HttpOnly cookie) via AppServiceProvider,
        // NOT session-based Sanctum, so CSRF is not needed and causes 419 errors.
        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);

        $middleware->alias([
            'permission' => \App\Http\Middleware\PermissionMiddleware::class,
            'throttle'   => \Illuminate\Routing\Middleware\ThrottleRequests::class,
        ]);

        // Inject Authorization Bearer từ HttpOnly cookie — PHẢI chạy TRƯỚC auth:sanctum
        // prependToGroup đảm bảo middleware này là FIRST trong api group
        // Cookie API routes không đi qua EncryptCookies nên giá trị cookie là plain text
        $middleware->prependToGroup('api', \App\Http\Middleware\TokenFromCookieMiddleware::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
