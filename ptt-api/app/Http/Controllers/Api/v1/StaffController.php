<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Eloquent\UserModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StaffController extends Controller
{
    /**
     * Lấy danh sách nhân sự của doanh nghiệp.
     */
    public function index(Request $request)
    {
        $companyId = $request->header('X-Company-Id');

        $this->syncExecutedMembers($companyId);

        $staffs = DB::table('staffs')
            ->join('users', 'staffs.user_id', '=', 'users.id')
            ->join('roles', 'staffs.role_id', '=', 'roles.id')
            ->where('staffs.company_id', $companyId)
            ->select(
                'staffs.id',
                'users.id as user_id',
                'users.name',
                'users.wallet_address',
                'users.email',
                'roles.id as role_id',
                'roles.name as role_name',
                'staffs.status',
                'staffs.created_at'
            )
            ->get();

        return response()->json($staffs);
    }

    /**
     * Đồng bộ hồi tố từ các đề xuất HĐQT đã thực thi.
     */
    private function syncExecutedMembers($companyId)
    {
        $proposals = DB::table('proposals')
            ->where('company_id', $companyId)
            ->whereIn('type', ['ADD_MEMBER', 'REMOVE_MEMBER'])
            ->where('status', 'EXECUTED')
            ->orderBy('id', 'asc')
            ->get();

        foreach ($proposals as $proposal) {
            $params = json_decode($proposal->params);
            $walletAddress = null;
            if (isset($params->member_address)) {
                $walletAddress = strtolower($params->member_address);
            } elseif (isset($params->calldata) && strlen($params->calldata) >= 74) {
                $walletAddress = '0x' . strtolower(substr($params->calldata, -40));
            }

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
        }
    }

    /**
     * Thêm nhân sự mới (hoặc cập nhật vai trò).
     */
    public function store(Request $request)
    {
        $request->validate([
            'wallet_address' => 'required|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'role_id' => 'required|integer',
        ]);

        $companyId = $request->header('X-Company-Id');
        $walletAddress = strtolower($request->input('wallet_address'));
        $roleId = $request->input('role_id');

        // 1. Kiểm tra xem role_id có thuộc về company_id này không
        $role = DB::table('roles')
            ->where('id', $roleId)
            ->where('company_id', $companyId)
            ->first();

        if (!$role) {
            return response()->json(['message' => 'Role not found or does not belong to this company'], 404);
        }

        $user = UserModel::firstOrCreate(
            ['wallet_address' => $walletAddress],
            [
                'name' => 'User-' . substr($walletAddress, -6),
                'email' => 'user-' . substr($walletAddress, -6) . '@ptt-web3.com',
                'kyc_status' => 'PENDING',
                'is_whitelisted' => false
            ]
        );

        // 3. Kiểm tra xem user này đã là staff của công ty chưa
        $existingStaff = DB::table('staffs')
            ->where('user_id', $user->id)
            ->where('company_id', $companyId)
            ->first();

        if ($existingStaff) {
            // Cập nhật vai trò và trạng thái
            DB::table('staffs')
                ->where('id', $existingStaff->id)
                ->update([
                    'role_id' => $roleId,
                    'status' => 'ACTIVE',
                    'updated_at' => now()
                ]);

            return response()->json(['message' => 'Staff role updated successfully']);
        }

        // 4. Thêm mới
        DB::table('staffs')->insert([
            'user_id' => $user->id,
            'company_id' => $companyId,
            'role_id' => $roleId,
            'status' => 'ACTIVE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Staff added successfully'], 201);
    }

    /**
     * Xóa nhân sự khỏi doanh nghiệp (chuyển sang INACTIVE).
     */
    public function destroy(Request $request, $id)
    {
        $companyId = $request->header('X-Company-Id');

        $staff = DB::table('staffs')
            ->where('id', $id)
            ->where('company_id', $companyId)
            ->first();

        if (!$staff) {
            return response()->json(['message' => 'Staff member not found'], 404);
        }

        // Không cho phép tự xóa chính mình
        if ($staff->user_id === $request->user()->id) {
            return response()->json(['message' => 'Cannot remove yourself from the company'], 422);
        }

        DB::table('staffs')
            ->where('id', $id)
            ->update([
                'status' => 'INACTIVE',
                'updated_at' => now()
            ]);

        return response()->json(['message' => 'Staff member deactivated successfully']);
    }

    /**
     * Lấy danh sách các vai trò (Roles) trong công ty.
     */
    public function indexRoles(Request $request)
    {
        $companyId = $request->header('X-Company-Id');

        $roles = DB::table('roles')
            ->where('company_id', $companyId)
            ->get()
            ->map(function ($role) {
                $role->permissions = json_decode($role->permissions);
                return $role;
            });

        return response()->json($roles);
    }
}
