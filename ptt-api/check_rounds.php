<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$rounds = \Illuminate\Support\Facades\DB::table('funding_rounds')->get();
foreach($rounds as $r) {
    echo "Round ID: " . $r->id . "\n";
    echo "Name: " . $r->name . "\n";
    echo "Payment Token Address: " . $r->payment_token_address . "\n";
    echo "Payment Token Symbol: " . $r->payment_token_symbol . "\n";
    echo "Status: " . $r->status . "\n";
    echo "---------------------------\n";
}
