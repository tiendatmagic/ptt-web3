<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Eloquent\UserModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    /**
     * Lấy danh sách KYC của hệ thống.
     */
    public function indexKyc(Request $request)
    {
        // Platform level check hoặc staff level check
        $users = UserModel::where('kyc_status', 'PENDING')
            ->select('id', 'name', 'wallet_address', 'email', 'kyc_status', 'created_at')
            ->get();

        return response()->json($users);
    }

    /**
     * Phê duyệt KYC cho người dùng.
     */
    public function approveKyc(Request $request, $id)
    {
        $user = UserModel::find($id);
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $user->kyc_status = 'APPROVED';
        $user->save();

        return response()->json([
            'message' => 'KYC approved successfully',
            'user' => [
                'id' => $user->id,
                'wallet_address' => $user->wallet_address,
                'kyc_status' => $user->kyc_status
            ]
        ]);
    }

    /**
     * Từ chối KYC cho người dùng.
     */
    public function rejectKyc(Request $request, $id)
    {
        $user = UserModel::find($id);
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $user->kyc_status = 'REJECTED';
        $user->save();

        return response()->json([
            'message' => 'KYC rejected successfully',
            'user' => [
                'id' => $user->id,
                'wallet_address' => $user->wallet_address,
                'kyc_status' => $user->kyc_status
            ]
        ]);
    }

    /**
     * Cập nhật thông tin profile cá nhân.
     */
    public function updateProfile(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:500',
        ]);

        $userModel = $request->user();
        $userModel->name = $request->input('name');
        $userModel->phone = $request->input('phone');
        $userModel->email = $request->input('email');
        $userModel->address = $request->input('address');
        $userModel->save();

        return response()->json([
            'message' => 'Profile updated successfully',
            'user' => [
                'id' => $userModel->id,
                'name' => $userModel->name,
                'wallet_address' => $userModel->wallet_address,
                'email' => $userModel->email,
                'phone' => $userModel->phone,
                'address' => $userModel->address,
                'kyc_status' => $userModel->kyc_status,
                'is_whitelisted' => $userModel->is_whitelisted,
                'is_blacklisted' => $userModel->is_blacklisted,
            ]
        ]);
    }

    /**
     * Yêu cầu xác minh KYC (cho người dùng).
     */
    public function requestKyc(Request $request)
    {
        $userModel = $request->user();
        if ($userModel->kyc_status === 'APPROVED') {
            return response()->json(['message' => 'KYC is already approved'], 422);
        }

        $userModel->kyc_status = 'PENDING';
        $userModel->save();

        return response()->json([
            'message' => 'KYC request submitted successfully',
            'kyc_status' => 'PENDING'
        ]);
    }

    /**
     * Đồng bộ Whitelist/Blacklist hàng loạt từ frontend.
     */
    public function batchSyncKyc(Request $request)
    {
        $request->validate([
            'addresses' => 'required|array',
            'addresses.*' => 'required|string|size:42',
            'action' => 'required|string|in:whitelist,blacklist,remove_whitelist,remove_blacklist'
        ]);

        $addresses = array_map('strtolower', $request->input('addresses'));
        $action = $request->input('action');
        $updatedCount = 0;

        foreach ($addresses as $addr) {
            $user = UserModel::firstOrNew(['wallet_address' => $addr]);

            if ($action === 'whitelist') {
                $user->kyc_status = 'APPROVED';
                $user->is_whitelisted = true;
                $user->is_blacklisted = false;
            } elseif ($action === 'blacklist') {
                $user->is_blacklisted = true;
                $user->is_whitelisted = false;
                $user->kyc_status = 'REJECTED';
            } elseif ($action === 'remove_whitelist') {
                $user->is_whitelisted = false;
                if ($user->kyc_status === 'APPROVED') {
                    $user->kyc_status = 'PENDING';
                }
            } elseif ($action === 'remove_blacklist') {
                $user->is_blacklisted = false;
            }

            $user->save();
            $updatedCount++;
        }

        return response()->json([
            'message' => "Successfully synced {$updatedCount} addresses",
            'updated_count' => $updatedCount
        ]);
    }
}
