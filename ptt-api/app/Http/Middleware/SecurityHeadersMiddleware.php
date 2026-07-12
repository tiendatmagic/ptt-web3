<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeadersMiddleware
{
    /**
     * Add security headers to every response.
     * Protects against: clickjacking, MIME sniffing, XSS, info leakage.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Prevent MIME type sniffing
        $response->header('X-Content-Type-Options', 'nosniff');

        // Prevent clickjacking
        $response->header('X-Frame-Options', 'DENY');

        // Enable XSS filter in older browsers
        $response->header('X-XSS-Protection', '1; mode=block');

        // Control referrer information sent to other origins
        $response->header('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Restrict browser feature access
        $response->header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

        // HSTS: Chỉ bật trên production HTTPS để tránh lỗi trên local HTTP
        // Bắt buộc browser dùng HTTPS cho 1 năm, bao gồm subdomains
        if ($request->secure() && config('app.env') === 'production') {
            $response->header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // Remove server fingerprint headers
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');

        return $response;
    }
}
