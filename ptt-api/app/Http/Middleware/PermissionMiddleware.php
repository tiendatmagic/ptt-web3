<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class PermissionMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        // Lấy company_id từ Header (hoặc Input, hoặc Route Parameter)
        $companyId = $request->header('X-Company-Id') 
            ?? $request->input('company_id') 
            ?? $request->route('company_id');

        if (!$companyId) {
            return response()->json(['message' => 'Missing X-Company-Id header or company_id parameter'], 400);
        }

        // Validate companyId là số nguyên dương để tránh unexpected query behavior
        $companyId = (int) $companyId;
        if ($companyId <= 0) {
            return response()->json(['message' => 'Invalid company_id: must be a positive integer'], 400);
        }

        // Truy vấn xem user có phải nhân viên và lấy permissions của role
        $staff = DB::table('staffs')
            ->join('roles', 'staffs.role_id', '=', 'roles.id')
            ->where('staffs.user_id', $user->id)
            ->where('staffs.company_id', $companyId)
            ->where('staffs.status', 'ACTIVE')
            ->select('roles.permissions')
            ->first();

        if (!$staff) {
            return response()->json(['message' => 'Unauthorized, not an active staff member of this company'], 403);
        }

        $permissions = json_decode($staff->permissions, true) ?: [];

        // Kiểm tra quyền (hỗ trợ '*' cho CEO/SuperAdmin)
        if (in_array('*', $permissions) || in_array($permission, $permissions)) {
            // Gắn company_id và permissions vào request để các controller sử dụng sau này nếu cần
            $request->attributes->set('company_id', $companyId);
            $request->attributes->set('staff_permissions', $permissions);
            
            return $next($request);
        }

        return response()->json(['message' => "Forbidden, missing permission: {$permission}"], 403);
    }
}
