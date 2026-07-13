<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Domain\Utils\Web3SignatureVerifier;
use App\Infrastructure\Persistence\Eloquent\UserModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProposalController extends Controller
{
    /**
     * Lấy danh sách đề xuất (proposals) của doanh nghiệp.
     */
    public function index(Request $request)
    {
        $companyId = $request->header('X-Company-Id');

        $proposals = DB::table('proposals')
            ->join('users', 'proposals.created_by', '=', 'users.id')
            ->where('proposals.company_id', $companyId)
            ->select(
                'proposals.*',
                'users.name as creator_name',
                'users.wallet_address as creator_wallet'
            )
            ->orderBy('proposals.created_at', 'desc')
            ->get()
            ->map(function ($proposal) {
                $proposal->params = json_decode($proposal->params);
                return $proposal;
            });

        return response()->json($proposals);
    }

    /**
     * Xem chi tiết đề xuất kèm chữ ký.
     */
    public function show(Request $request, $id)
    {
        $companyId = $request->header('X-Company-Id');

        $proposal = DB::table('proposals')
            ->join('users', 'proposals.created_by', '=', 'users.id')
            ->where('proposals.id', $id)
            ->where('proposals.company_id', $companyId)
            ->select(
                'proposals.*',
                'users.name as creator_name',
                'users.wallet_address as creator_wallet'
            )
            ->first();

        if (!$proposal) {
            return response()->json(['message' => 'Proposal not found'], 404);
        }

        $proposal->params = json_decode($proposal->params);

        // Lấy danh sách chữ ký
        $signatures = DB::table('proposal_signatures')
            ->where('proposal_id', $id)
            ->get();

        // Tính toán ngưỡng phê duyệt (threshold) giống như lúc sign
        $boardMembersCount = DB::table('staffs')
            ->join('roles', 'staffs.role_id', '=', 'roles.id')
            ->where('staffs.company_id', $companyId)
            ->where('staffs.status', 'ACTIVE')
            ->where(function ($query) {
                $query->where('roles.name', 'Owner')
                      ->orWhere('roles.name', 'Board Member');
            })
            ->count();
        $threshold = max(1, ceil($boardMembersCount / 2));

        return response()->json([
            'proposal' => $proposal,
            'signatures' => $signatures,
            'threshold' => $threshold
        ]);
    }

    /**
     * Tạo đề xuất mới.
     */
    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'required|string|in:MINT,BURN,WITHDRAW,DIVIDEND,FUNDING_ROUND,CONFIG,ADD_MEMBER,REMOVE_MEMBER,CHANGE_THRESHOLD,PAUSE_TOKEN,UNPAUSE_TOKEN',
            'params' => 'nullable|array',
            'expiration_date' => 'nullable|date|after:now',
        ]);

        $companyId = $request->header('X-Company-Id');
        $user = $request->user();

        $proposalId = DB::table('proposals')->insertGetId([
            'company_id' => $companyId,
            'title' => $request->input('title'),
            'description' => $request->input('description'),
            'type' => $request->input('type'),
            'params' => json_encode($request->input('params')),
            'status' => 'PENDING',
            'expiration_date' => $request->input('expiration_date') ? \Illuminate\Support\Carbon::parse($request->input('expiration_date')) : null,
            'created_by' => $user->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Proposal created successfully',
            'proposal_id' => $proposalId
        ], 201);
    }

    /**
     * Gửi chữ ký số biểu quyết (EIP-712/personal_sign) phê duyệt đề xuất.
     */
    public function sign(Request $request, $id)
    {
        $request->validate([
            'signature' => 'required|string',
            'message' => 'required|string', // Thông điệp EIP-712 được ký bởi ví
            'threshold' => 'nullable|integer|min:1',
        ]);

        $companyId = $request->header('X-Company-Id');
        $user = $request->user();
        $signature = $request->input('signature');
        $message = $request->input('message');

        // 1. Kiểm tra proposal tồn tại và đúng công ty
        $proposal = DB::table('proposals')
            ->where('id', $id)
            ->where('company_id', $companyId)
            ->first();

        if (!$proposal) {
            return response()->json(['message' => 'Proposal not found'], 404);
        }

        if ($proposal->status !== 'PENDING') {
            return response()->json(['message' => 'Proposal is not open for signatures'], 422);
        }

        // 2. Xác thực chữ ký ví Web3
        $walletAddress = strtolower($user->wallet_address);
        $isValid = Web3SignatureVerifier::verify($walletAddress, $message, $signature);

        if (!$isValid) {
            return response()->json(['message' => 'Invalid wallet signature'], 422);
        }

        // 3. Lưu hoặc cập nhật chữ ký số
        $existingSig = DB::table('proposal_signatures')
            ->where('proposal_id', $id)
            ->where('wallet_address', $walletAddress)
            ->first();

        if ($existingSig) {
            DB::table('proposal_signatures')
                ->where('id', $existingSig->id)
                ->update([
                    'signature' => $signature,
                    'status' => 'SIGNED',
                    'updated_at' => now()
                ]);
        } else {
            DB::table('proposal_signatures')->insert([
                'proposal_id' => $id,
                'wallet_address' => $walletAddress,
                'signature' => $signature,
                'status' => 'SIGNED',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $signedCount = DB::table('proposal_signatures')
            ->where('proposal_id', $id)
            ->where('status', 'SIGNED')
            ->count();

        // 4. Kiểm tra số lượng chữ ký để chuyển trạng thái sang APPROVED
        // Ưu tiên sử dụng threshold gửi lên từ Smart Contract, nếu không có mới tự tính fallback
        $threshold = $request->input('threshold');
        if (!$threshold) {
            $boardMembersCount = DB::table('staffs')
                ->join('roles', 'staffs.role_id', '=', 'roles.id')
                ->where('staffs.company_id', $companyId)
                ->where('staffs.status', 'ACTIVE')
                ->where(function ($query) {
                    $query->where('roles.name', 'Owner')
                          ->orWhere('roles.name', 'Board Member');
                })
                ->count();

            $threshold = max(1, ceil($boardMembersCount / 2));
        }
        
        if ($signedCount >= $threshold) {
            DB::table('proposals')
                ->where('id', $id)
                ->update([
                    'status' => 'APPROVED',
                    'updated_at' => now()
                ]);
        }

        return response()->json([
            'message' => 'Proposal signed successfully',
            'signed_count' => $signedCount,
            'threshold' => $threshold,
            'status' => $signedCount >= $threshold ? 'APPROVED' : 'PENDING'
        ]);
    }

    /**
     * Đánh dấu đề xuất đã được thực thi thành công trên blockchain.
     */
    public function execute(Request $request, $id)
    {
        $request->validate([
            'tx_hash' => 'nullable|string|regex:/^0x[a-fA-F0-9]{64}$/'
        ]);

        $companyId = $request->header('X-Company-Id');
        $txHash = $request->input('tx_hash');

        $proposal = DB::table('proposals')
            ->where('id', $id)
            ->where('company_id', $companyId)
            ->first();

        if (!$proposal) {
            return response()->json(['message' => 'Proposal not found'], 404);
        }

        // Cho phép cập nhật cả khi PENDING, APPROVED lẫn khi đã EXECUTED (sync lại từ on-chain)
        if (!in_array($proposal->status, ['PENDING', 'APPROVED', 'EXECUTED'])) {
            return response()->json(['message' => 'Proposal cannot be executed in this status'], 422);
        }

        DB::transaction(function () use ($id, $companyId, $txHash, $proposal) {
            DB::table('proposals')
                ->where('id', $id)
                ->update([
                    'status' => 'EXECUTED',
                    'tx_hash' => $txHash,
                    'effective_date' => now(),
                    'updated_at' => now()
                ]);

            // Đồng bộ thành viên HĐQT nếu là ADD_MEMBER / REMOVE_MEMBER
            $params = json_decode($proposal->params);
            $walletAddress = isset($params->member_address) ? strtolower($params->member_address) : null;

            if ($walletAddress) {
                if ($proposal->type === 'ADD_MEMBER') {
                    $user = UserModel::firstOrCreate(
                        ['wallet_address' => $walletAddress],
                        [
                            'name' => 'User-' . substr($walletAddress, -6),
                            'email' => 'user-' . substr($walletAddress, -6) . '@ptt-web3.com',
                            'kyc_status' => 'PENDING',
                            'is_whitelisted' => false
                        ]
                    );

                    $role = DB::table('roles')
                        ->where('company_id', $companyId)
                        ->where(function($q) {
                            $q->where('name', 'Board Member')
                              ->orWhere('name', 'Owner')
                              ->orWhere('name', 'Quản lý');
                        })
                        ->first();
                    
                    if ($role) {
                        $existingStaff = DB::table('staffs')
                            ->where('user_id', $user->id)
                            ->where('company_id', $companyId)
                            ->first();

                        if ($existingStaff) {
                            DB::table('staffs')
                                ->where('id', $existingStaff->id)
                                ->update([
                                    'role_id' => $role->id,
                                    'status' => 'ACTIVE',
                                    'updated_at' => now()
                                ]);
                        } else {
                            DB::table('staffs')->insert([
                                'user_id' => $user->id,
                                'company_id' => $companyId,
                                'role_id' => $role->id,
                                'status' => 'ACTIVE',
                                'created_at' => now(),
                                'updated_at' => now()
                            ]);
                        }
                    }
                } elseif ($proposal->type === 'REMOVE_MEMBER') {
                    $user = DB::table('users')->where('wallet_address', $walletAddress)->first();
                    if ($user) {
                        DB::table('staffs')
                            ->where('user_id', $user->id)
                            ->where('company_id', $companyId)
                            ->update([
                                'status' => 'INACTIVE',
                                'updated_at' => now()
                            ]);
                    }
                }
            }
        });

        return response()->json([
            'message' => 'Proposal marked as EXECUTED',
            'tx_hash' => $txHash
        ]);
    }
}
