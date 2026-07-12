<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TokenFromCookieMiddleware
{
    /**
     * Inject Authorization Bearer header từ HttpOnly cookie auth_token.
     *
     * Middleware này chạy SAU EncryptCookies nên cookie đã được decrypt,
     * khác với AppServiceProvider::boot() chạy TRƯỚC khi cookies được xử lý.
     *
     * Cho phép Sanctum authenticate qua cookie mà không cần frontend
     * gửi Bearer header thủ công — phục vụ session restore khi reload trang.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Chỉ inject nếu chưa có Authorization header (tránh override khi frontend gửi Bearer)
        if (!$request->bearerToken() && $request->hasCookie('auth_token')) {
            $request->headers->set(
                'Authorization',
                'Bearer ' . $request->cookie('auth_token')
            );
        }

        return $next($request);
    }
}
