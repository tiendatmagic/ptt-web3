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
            'name' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
        ]);

        $userModel = $request->user();
        if ($request->has('name')) {
            $userModel->name = $request->input('name');
        }
        if ($request->has('email')) {
            $userModel->email = $request->input('email');
        }
        $userModel->save();

        return response()->json([
            'message' => 'Profile updated successfully',
            'user' => [
                'id' => $userModel->id,
                'name' => $userModel->name,
                'wallet_address' => $userModel->wallet_address,
                'email' => $userModel->email,
                'kyc_status' => $userModel->kyc_status,
                'is_whitelisted' => $userModel->is_whitelisted,
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
}
