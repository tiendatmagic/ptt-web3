<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Domain\Repositories\CompanyRepositoryInterface;
use App\Domain\Entities\Company;
use App\Http\Requests\Company\RegisterCompanyRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CompanyController extends Controller
{
    private CompanyRepositoryInterface $companyRepository;

    public function __construct(CompanyRepositoryInterface $companyRepository)
    {
        $this->companyRepository = $companyRepository;
    }

    /**
     * Lấy danh sách công ty.
     */
    public function index()
    {
        $companies = $this->companyRepository->all();
        
        $result = array_map(function ($company) {
            return [
                'id' => $company->getId(),
                'code' => $company->getCode(),
                'name' => $company->getName(),
                'logo' => $company->getLogo(),
                'valuation' => $company->getValuation(),
                'token_address' => $company->getTokenAddress(),
                'status' => $company->getStatus(),
            ];
        }, $companies);

        return response()->json($result);
    }

    /**
     * Lấy chi tiết công ty.
     */
    public function show(string $code)
    {
        $company = $this->companyRepository->findByCode($code);
        if (!$company) {
            return response()->json([
                'message' => 'Company not found'
            ], 404);
        }

        return response()->json([
            'id' => $company->getId(),
            'code' => $company->getCode(),
            'name' => $company->getName(),
            'logo' => $company->getLogo(),
            'valuation' => $company->getValuation(),
            'registry_address' => $company->getRegistryAddress(),
            'governance_address' => $company->getGovernanceAddress(),
            'token_address' => $company->getTokenAddress(),
            'treasury_address' => $company->getTreasuryAddress(),
            'funding_address' => $company->getFundingAddress(),
            'distribution_address' => $company->getDistributionAddress(),
            'marketplace_address' => $company->getMarketplaceAddress(),
            'oracle_address' => $company->getOracleAddress(),
            'status' => $company->getStatus(),
        ]);
    }

    /**
     * Đăng ký công ty và khởi tạo các Roles mặc định.
     */
    public function register(RegisterCompanyRequest $request)
    {
        $user = $request->user();

        // Sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
        $company = DB::transaction(function () use ($request, $user) {
            // 1. Tạo Company Entity
            $company = new Company(
                null,
                $request->input('code'),
                $request->input('name'),
                $request->input('logo'),
                $request->input('valuation'),
                $request->input('registry_address'),
                $request->input('governance_address'),
                $request->input('token_address'),
                $request->input('treasury_address'),
                $request->input('funding_address'),
                $request->input('distribution_address'),
                $request->input('marketplace_address'),
                $request->input('oracle_address')
            );

            $savedCompany = $this->companyRepository->save($company);
            $companyId = $savedCompany->getId();

            // 2. Tạo các vai trò mặc định cho công ty
            // Role CEO (Chủ quán) - Full quyền
            $ceoRoleId = DB::table('roles')->insertGetId([
                'company_id' => $companyId,
                'name' => 'Chủ quán',
                'permissions' => json_encode(['*']),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Role Quản lý (Manager)
            DB::table('roles')->insert([
                'company_id' => $companyId,
                'name' => 'Quản lý',
                'permissions' => json_encode([
                    'staffs.view', 'staffs.create', 'staffs.edit',
                    'proposals.view', 'proposals.create', 'proposals.sign',
                    'funding.view', 'dividends.view', 'marketplace.view'
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Role Thu ngân (Cashier)
            DB::table('roles')->insert([
                'company_id' => $companyId,
                'name' => 'Thu ngân',
                'permissions' => json_encode([
                    'proposals.view',
                    'funding.view',
                    'marketplace.view'
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Role Kế toán (Accountant)
            DB::table('roles')->insert([
                'company_id' => $companyId,
                'name' => 'Kế toán',
                'permissions' => json_encode([
                    'dividends.view', 'dividends.create', 'dividends.execute',
                    'proposals.view', 'proposals.create',
                    'funding.view', 'marketplace.view'
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 3. Gắn User tạo công ty làm CEO (Chủ quán)
            DB::table('staffs')->insert([
                'user_id' => $user->id,
                'company_id' => $companyId,
                'role_id' => $ceoRoleId,
                'status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $savedCompany;
        });

        return response()->json([
            'message' => 'Company registered successfully',
            'company' => [
                'id' => $company->getId(),
                'code' => $company->getCode(),
                'name' => $company->getName(),
                'registry_address' => $company->getRegistryAddress(),
                'token_address' => $company->getTokenAddress(),
            ]
        ], 201);
    }
}
