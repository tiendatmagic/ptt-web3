<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Cấu hình CORS cho phép Angular frontend gọi API.
    | Khi deploy production, set CORS_ALLOWED_ORIGINS trong .env:
    |   CORS_ALLOWED_ORIGINS=https://app.yourdomain.com
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Đọc từ env để dễ cấu hình production mà không cần sửa code
    // Khi supports_credentials = true, KHÔNG được dùng wildcard '*'
    'allowed_origins' => array_map(
        'trim',
        explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:4200,http://localhost:4201'))
    ),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // CRITICAL: Phải là true để cookie HttpOnly (auth_token) hoạt động với withCredentials
    'supports_credentials' => true,

];

