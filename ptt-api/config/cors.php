<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Khi supports_credentials = true, allowed_origins KHÔNG được dùng wildcard '*'.
    // Phải khai báo rõ origin của Frontend Angular.
    'allowed_origins' => [
        'http://localhost:4200',
        'http://localhost:4201',
        'http://127.0.0.1:4200',
        'http://127.0.0.1:4201',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // CRITICAL: Phải là true để cookie HttpOnly (auth_token) hoạt động với withCredentials
    'supports_credentials' => true,

];
