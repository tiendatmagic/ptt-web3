<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Domain\Utils\Web3SignatureVerifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MarketplaceController extends Controller
{
    /**
     * Lấy sổ lệnh (Order Book) của doanh nghiệp.
     */
    public function orderBook(Request $request)
    {
        $companyId = $request->header('X-Company-Id') ?? $request->query('company_id');

        if (!$companyId) {
            return response()->json(['message' => 'Missing company_id'], 400);
        }

        $paymentToken = $request->query('payment_token_address');

        // Lấy danh sách lệnh mua
        $buyOrdersQuery = DB::table('orders')
            ->where('company_id', $companyId)
            ->where('side', 'BUY')
            ->whereIn('status', ['PENDING', 'PARTIALLY_FILLED']);

        if ($paymentToken) {
            $buyOrdersQuery->where('payment_token_address', $paymentToken);
        }

        $buyOrders = $buyOrdersQuery->select('id', 'user_address', 'price', 'amount', 'filled_amount', 'payment_token_address', 'payment_token_symbol', 'created_at')
            ->orderBy('price', 'desc')
            ->orderBy('created_at', 'asc')
            ->limit(50)
            ->get();

        // Lấy danh sách lệnh bán
        $sellOrdersQuery = DB::table('orders')
            ->where('company_id', $companyId)
            ->where('side', 'SELL')
            ->whereIn('status', ['PENDING', 'PARTIALLY_FILLED']);

        if ($paymentToken) {
            $sellOrdersQuery->where('payment_token_address', $paymentToken);
        }

        $sellOrders = $sellOrdersQuery->select('id', 'user_address', 'price', 'amount', 'filled_amount', 'payment_token_address', 'payment_token_symbol', 'created_at')
            ->orderBy('price', 'asc')
            ->orderBy('created_at', 'asc')
            ->limit(50)
            ->get();

        return response()->json([
            'buy' => $buyOrders,
            'sell' => $sellOrders
        ]);
    }

    /**
     * Đặt lệnh mua/bán mới và tự động khớp lệnh (Order Matcher Engine).
     */
    public function placeOrder(Request $request)
    {
        $request->validate([
            'side' => 'required|string|in:BUY,SELL',
            'price' => 'required|numeric|gt:0',
            'amount' => 'required|numeric|gt:0',
            'signature' => 'required|string',
            'message' => 'required|string', // Thông điệp EIP-712 phê duyệt giao dịch khớp lệnh
            'payment_token_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'payment_token_symbol' => 'nullable|string|max:50',
        ]);

        $companyId = $request->header('X-Company-Id');
        $user = $request->user();
        $side = $request->input('side');
        $price = $request->input('price');
        $amount = $request->input('amount');
        $signatureFull = $request->input('signature');
        $message = $request->input('message');
        $paymentTokenAddress = $request->input('payment_token_address');
        $paymentTokenSymbol = $request->input('payment_token_symbol') ?: 'USDT';
        $walletAddress = strtolower($user->wallet_address);

        // Phân tách signature gốc để verify
        $sigParts = explode('_', $signatureFull);
        $signature = $sigParts[0];

        // 1. Xác thực chữ ký ví Web3
        $isValid = Web3SignatureVerifier::verify($walletAddress, $message, $signature);
        if (!$isValid) {
            return response()->json(['message' => 'Invalid wallet signature'], 422);
        }

        // 2. Lưu order mới vào Database
        $orderId = DB::transaction(function () use ($companyId, $walletAddress, $side, $price, $amount, $signatureFull, $paymentTokenAddress, $paymentTokenSymbol) {
            return DB::table('orders')->insertGetId([
                'company_id' => $companyId,
                'user_address' => $walletAddress,
                'side' => $side,
                'price' => $price,
                'amount' => $amount,
                'filled_amount' => 0,
                'signature' => $signatureFull, // Lưu đầy đủ signature kèm nonce, deadline
                'payment_token_address' => $paymentTokenAddress,
                'payment_token_symbol' => $paymentTokenSymbol,
                'status' => 'PENDING',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        // 3. Khởi chạy Matcher Engine
        $this->matchOrders($orderId);

        // Lấy lại thông tin order sau khi khớp
        $order = DB::table('orders')->where('id', $orderId)->first();

        return response()->json([
            'message' => 'Order placed successfully',
            'order' => $order
        ], 201);
    }

    /**
     * Hủy lệnh giao dịch.
     */
    public function cancelOrder(Request $request, $id)
    {
        $companyId = $request->header('X-Company-Id');
        $user = $request->user();
        $walletAddress = strtolower($user->wallet_address);

        $order = DB::table('orders')
            ->where('id', $id)
            ->where('company_id', $companyId)
            ->first();

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        if ($order->user_address !== $walletAddress) {
            return response()->json(['message' => 'Unauthorized to cancel this order'], 403);
        }

        if (!in_array($order->status, ['PENDING', 'PARTIALLY_FILLED'])) {
            return response()->json(['message' => 'Order cannot be cancelled in its current state'], 422);
        }

        DB::table('orders')
            ->where('id', $id)
            ->update([
                'status' => 'CANCELLED',
                'updated_at' => now()
            ]);

        return response()->json(['message' => 'Order cancelled successfully']);
    }

    /**
     * Lấy lịch sử giao dịch khớp lệnh.
     */
    public function tradeHistory(Request $request)
    {
        $companyId = $request->header('X-Company-Id') ?? $request->query('company_id');

        if (!$companyId) {
            return response()->json(['message' => 'Missing company_id'], 400);
        }

        $paymentToken = $request->query('payment_token_address');
        $perPage = $request->query('per_page', 5);

        $tradesQuery = DB::table('trades')
            ->join('orders as buy_order', 'trades.buy_order_id', '=', 'buy_order.id')
            ->join('orders as sell_order', 'trades.sell_order_id', '=', 'sell_order.id')
            ->where('buy_order.company_id', $companyId);

        if ($paymentToken) {
            $tradesQuery->where('trades.payment_token_address', $paymentToken);
        }

        $trades = $tradesQuery->select(
                'trades.id',
                'buy_order.id as buy_order_id',
                'sell_order.id as sell_order_id',
                'buy_order.user_address as buyer_address',
                'sell_order.user_address as seller_address',
                'buy_order.signature as buyer_signature',
                'sell_order.signature as seller_signature',
                'trades.price',
                'trades.amount',
                'trades.payment_token_address',
                'trades.payment_token_symbol',
                'trades.tx_hash',
                'trades.created_at'
            )
            ->orderBy('trades.created_at', 'desc')
            ->paginate($perPage);

        return response()->json($trades);
    }

    /**
     * Lấy danh sách lệnh của chính người dùng (bao gồm cả đang treo và lịch sử).
     */
    public function myOrders(Request $request)
    {
        $companyId = $request->header('X-Company-Id') ?? $request->query('company_id');

        if (!$companyId) {
            return response()->json(['message' => 'Missing company_id'], 400);
        }

        $user = $request->user();
        $walletAddress = strtolower($user->wallet_address);
        
        $paymentToken = $request->query('payment_token_address');
        $status = $request->query('status'); // ACTIVE (PENDING/PARTIALLY_FILLED), HISTORY (FILLED/CANCELLED), ALL
        $perPage = $request->query('per_page', 5);

        $query = DB::table('orders')
            ->where('company_id', $companyId)
            ->where('user_address', $walletAddress);

        if ($paymentToken) {
            $query->where('payment_token_address', $paymentToken);
        }

        if ($status === 'ACTIVE') {
            $query->whereIn('status', ['PENDING', 'PARTIALLY_FILLED']);
        } elseif ($status === 'HISTORY') {
            $query->whereIn('status', ['FILLED', 'CANCELLED']);
        }

        $orders = $query->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json($orders);
    }

    /**
     * Ghi nhận giao dịch đã được settlement thành công on-chain.
     */
    public function settleTrade(Request $request)
    {
        $request->validate([
            'buy_order_id' => 'required|integer',
            'sell_order_id' => 'required|integer',
            'price' => 'required|numeric',
            'amount' => 'required|numeric',
            'tx_hash' => 'required|string|regex:/^0x[a-fA-F0-9]{64}$/'
        ]);

        DB::transaction(function () use ($request) {
            $existing = DB::table('trades')
                ->where('buy_order_id', $request->input('buy_order_id'))
                ->where('sell_order_id', $request->input('sell_order_id'))
                ->where('price', $request->input('price'))
                ->where('amount', $request->input('amount'))
                ->where('tx_hash', 'MATCHED_PENDING_SETTLEMENT')
                ->first();

            if ($existing) {
                DB::table('trades')
                    ->where('id', $existing->id)
                    ->update([
                        'tx_hash' => $request->input('tx_hash'),
                        'updated_at' => now()
                    ]);
            } else {
                $buyOrder = DB::table('orders')->where('id', $request->input('buy_order_id'))->first();
                DB::table('trades')->insert([
                    'buy_order_id' => $request->input('buy_order_id'),
                    'sell_order_id' => $request->input('sell_order_id'),
                    'price' => $request->input('price'),
                    'amount' => $request->input('amount'),
                    'payment_token_address' => $buyOrder ? $buyOrder->payment_token_address : null,
                    'payment_token_symbol' => $buyOrder ? $buyOrder->payment_token_symbol : 'USDT',
                    'tx_hash' => $request->input('tx_hash'),
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }
        });

        return response()->json(['message' => 'Trade settlement registered successfully']);
    }

    /**
     * Thuật toán Matcher Engine khớp lệnh BUY/SELL.
     */
    private function matchOrders(int $orderId)
    {
        $order = DB::table('orders')->where('id', $orderId)->first();
        if (!$order || !in_array($order->status, ['PENDING', 'PARTIALLY_FILLED'])) {
            return;
        }

        $companyId = $order->company_id;
        $side = $order->side;
        $price = $order->price;
        $paymentToken = $order->payment_token_address;

        DB::transaction(function () use ($order, $companyId, $side, $price, $paymentToken) {
            $remaining = $order->amount - $order->filled_amount;
            if ($remaining <= 0) return;

            if ($side === 'BUY') {
                // Tìm các lệnh bán đối ứng có giá bán <= giá mua, cùng payment token
                $matches = DB::table('orders')
                    ->where('company_id', $companyId)
                    ->where('side', 'SELL')
                    ->where('payment_token_address', $paymentToken)
                    ->whereIn('status', ['PENDING', 'PARTIALLY_FILLED'])
                    ->where('price', '<=', $price)
                    ->orderBy('price', 'asc')
                    ->orderBy('created_at', 'asc')
                    ->get();
            } else {
                // Tìm các lệnh mua đối ứng có giá mua >= giá bán, cùng payment token
                $matches = DB::table('orders')
                    ->where('company_id', $companyId)
                    ->where('side', 'BUY')
                    ->where('payment_token_address', $paymentToken)
                    ->whereIn('status', ['PENDING', 'PARTIALLY_FILLED'])
                    ->where('price', '>=', $price)
                    ->orderBy('price', 'desc')
                    ->orderBy('created_at', 'asc')
                    ->get();
            }

            foreach ($matches as $match) {
                if ($remaining <= 0) break;

                $matchRemaining = $match->amount - $match->filled_amount;
                if ($matchRemaining <= 0) continue;

                // Tính toán lượng khớp
                $matchedAmount = min($remaining, $matchRemaining);
                
                // Giá khớp lệnh lấy theo giá của lệnh đã nằm trong sổ lệnh trước (lệnh cũ hơn)
                $matchedPrice = $match->price;

                // Cập nhật lượng khớp cho đối ứng
                $newMatchFilled = $match->filled_amount + $matchedAmount;
                $matchStatus = ($newMatchFilled >= $match->amount) ? 'FILLED' : 'PARTIALLY_FILLED';
                
                DB::table('orders')
                    ->where('id', $match->id)
                    ->update([
                        'filled_amount' => $newMatchFilled,
                        'status' => $matchStatus,
                        'updated_at' => now()
                    ]);

                // Cập nhật lượng khớp cho chính order hiện tại
                $orderFilled = DB::table('orders')->where('id', $order->id)->value('filled_amount');
                $newOrderFilled = $orderFilled + $matchedAmount;
                $orderStatus = ($newOrderFilled >= $order->amount) ? 'FILLED' : 'PARTIALLY_FILLED';

                DB::table('orders')
                    ->where('id', $order->id)
                    ->update([
                        'filled_amount' => $newOrderFilled,
                        'status' => $orderStatus,
                        'updated_at' => now()
                    ]);

                // Ghi nhận bản ghi khớp lệnh (Trade) tạm thời chờ On-chain Settlement
                DB::table('trades')->insert([
                    'buy_order_id' => ($side === 'BUY') ? $order->id : $match->id,
                    'sell_order_id' => ($side === 'SELL') ? $order->id : $match->id,
                    'price' => $matchedPrice,
                    'amount' => $matchedAmount,
                    'payment_token_address' => $paymentToken,
                    'payment_token_symbol' => $order->payment_token_symbol,
                    'tx_hash' => 'MATCHED_PENDING_SETTLEMENT', // Chờ frontend trigger smart contract settleTrade
                    'created_at' => now(),
                ]);

                $remaining -= $matchedAmount;
            }
        });
    }
}
