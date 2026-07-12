<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Domain\Repositories\UserRepositoryInterface;
use App\Domain\Entities\User;
use App\Domain\Utils\Web3SignatureVerifier;
use App\Infrastructure\Persistence\Eloquent\UserModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    private UserRepositoryInterface $userRepository;

    public function __construct(UserRepositoryInterface $userRepository)
    {
        $this->userRepository = $userRepository;
    }

    /**
     * Lấy nonce challenge phục vụ đăng nhập ví Web3.
     */
    public function challenge(Request $request)
    {
        $request->validate([
            'address' => 'required|string|regex:/^0x[a-fA-F0-9]{40}$/'
        ]);

        $address = strtolower($request->query('address'));
        
        // Sinh nonce ngẫu nhiên và lưu vào cache trong 5 phút
        $nonce = Str::random(16);
        Cache::put("web3_nonce_{$address}", $nonce, now()->addMinutes(5));

        $message = "Sign in to PTT Dapp\nWallet address: {$address}\nNonce: {$nonce}";

        return response()->json([
            'message' => $message,
            'nonce' => $nonce
        ]);
    }

    /**
     * Đăng nhập ví Web3 thông qua chữ ký số.
     */
    public function login(Request $request)
    {
        $request->validate([
            'address' => 'required|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'message' => 'required|string',
            'signature' => 'required|string'
        ]);

        $address = strtolower($request->input('address'));
        $message = $request->input('message');
        $signature = $request->input('signature');

        // Lấy nonce từ cache để xác thực tính toàn vẹn (chống Replay Attack)
        $nonceKey = "web3_nonce_{$address}";
        $cachedNonce = Cache::get($nonceKey);

        if (!$cachedNonce || !str_contains($message, "Nonce: {$cachedNonce}")) {
            Log::warning('[Auth] Login failed: nonce expired or invalid', [
                'ip'      => $request->ip(),
                'address' => $address,
                'reason'  => $cachedNonce ? 'nonce_mismatch' : 'nonce_expired',
            ]);
            return response()->json([
                'message' => 'Challenge session expired or invalid'
            ], 422);
        }

        // Xác thực chữ ký số
        $isValid = Web3SignatureVerifier::verify($address, $message, $signature);
        if (!$isValid) {
            Log::warning('[Auth] Login failed: invalid wallet signature', [
                'ip'      => $request->ip(),
                'address' => $address,
            ]);
            return response()->json([
                'message' => 'Invalid wallet signature'
            ], 422);
        }

        // Xóa nonce khỏi cache sau khi đã dùng
        Cache::forget($nonceKey);

        // Tìm hoặc tạo User mới
        $user = $this->userRepository->findByWalletAddress($address);
        if (!$user) {
            // Tự động đăng ký với name là null (người dùng sẽ tự đặt lại họ tên sau)
            $user = new User(
                null,
                null,
                $address,
                null,
                null,
                null
            );
            $user = $this->userRepository->save($user);
        }

        // Lấy Eloquent model tương ứng để sinh token Sanctum
        $userModel = UserModel::find($user->getId());
        
        // Tạo token
        $token = $userModel->createToken('auth_token')->plainTextToken;

        // Save token to HttpOnly cookie (valid 7 days = 1 week)
        // SameSite=None chỉ dùng trên production HTTPS (bắt buộc phải có Secure=true)
        // Dev HTTP: dùng Lax — localhost:4200 → localhost:8000 là same-site (cùng host, khác port)
        $isProduction = config('app.env') === 'production';
        $sameSite = $isProduction ? 'None' : 'Lax';

        $cookie = cookie(
            'auth_token',
            $token,
            10080, // minutes = 7 days
            '/',
            null,
            $isProduction, // secure: true chỉ trên production (HTTPS)
            true,          // httpOnly: true — JS không đọc được
            false,
            $sameSite
        );

        // Secondary cookie (readable by JS) để frontend detect trạng thái login
        $loggedInCookie = cookie(
            'auth_logged_in',
            'true',
            10080,
            '/',
            null,
            $isProduction,
            false, // httpOnly=false — Angular có thể đọc
            false,
            $sameSite
        );

        return response()->json([
            'user' => [
                'id'             => $user->getId(),
                'name'           => $user->getName(),
                'wallet_address' => $user->getWalletAddress(),
                'email'          => $user->getEmail(),
                'phone'          => $user->getPhone(),
                'address'        => $user->getAddress(),
                'kyc_status'     => $user->getKycStatus(),
                'is_whitelisted' => $user->isWhitelisted(),
            ],
            // Auth qua HttpOnly cookie auth_token — không expose token trong response
        ])->withCookie($cookie)->withCookie($loggedInCookie);
    }

    /**
     * Đăng xuất.
     */
    public function logout(Request $request)
    {
        // Thu hồi token của user hiện tại
        if ($request->user()) {
            $request->user()->currentAccessToken()->delete();
        }

        // Xóa cookies
        $cookie = cookie()->forget('auth_token');
        $loggedInCookie = cookie()->forget('auth_logged_in');

        return response()->json([
            'message' => 'Logged out successfully'
        ])->withCookie($cookie)->withCookie($loggedInCookie);
    }

    /**
     * Lấy thông tin user hiện tại.
     */
    public function me(Request $request)
    {
        $userModel = $request->user();
        return response()->json([
            'user' => [
                'id' => $userModel->id,
                'name' => $userModel->name,
                'wallet_address' => $userModel->wallet_address,
                'email' => $userModel->email,
                'phone' => $userModel->phone,
                'address' => $userModel->address,
                'kyc_status' => $userModel->kyc_status,
                'is_whitelisted' => $userModel->is_whitelisted,
            ]
        ]);
    }
}
