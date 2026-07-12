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

            // 2. Create default roles for the company
            // Role: Owner - Full permissions
            $ceoRoleId = DB::table('roles')->insertGetId([
                'company_id' => $companyId,
                'name' => 'Owner',
                'permissions' => json_encode(['*']),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Role: Board Member (Thành viên HĐQT)
            DB::table('roles')->insert([
                'company_id' => $companyId,
                'name' => 'Board Member',
                'permissions' => json_encode([
                    'staffs.view', 'staffs.create', 'staffs.edit',
                    'proposals.view', 'proposals.create', 'proposals.sign',
                    'funding.view', 'dividends.view', 'marketplace.view'
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 3. Assign the company creator as Owner
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

    /**
     * Cập nhật địa chỉ các Smart Contracts thủ công.
     */
    public function updateContracts(Request $request, int $id)
    {
        $companyModel = \App\Infrastructure\Persistence\Eloquent\CompanyModel::find($id);
        if (!$companyModel) {
            return response()->json([
                'message' => 'Company not found'
            ], 404);
        }

        $validated = $request->validate([
            'registry_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'governance_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'token_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'treasury_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'funding_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'distribution_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'marketplace_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'oracle_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
        ]);

        foreach ($validated as $key => $value) {
            $companyModel->$key = $value;
        }
        $companyModel->save();

        return response()->json([
            'message' => 'Contract addresses updated successfully',
            'company' => [
                'id' => $companyModel->id,
                'code' => $companyModel->code,
                'name' => $companyModel->name,
                'registry_address' => $companyModel->registry_address,
                'governance_address' => $companyModel->governance_address,
                'token_address' => $companyModel->token_address,
                'treasury_address' => $companyModel->treasury_address,
                'funding_address' => $companyModel->funding_address,
                'distribution_address' => $companyModel->distribution_address,
                'marketplace_address' => $companyModel->marketplace_address,
                'oracle_address' => $companyModel->oracle_address,
            ]
        ]);
    }

    /**
     * Cập nhật thông tin cơ bản của công ty.
     */
    public function update(Request $request, int $id)
    {
        $companyModel = \App\Infrastructure\Persistence\Eloquent\CompanyModel::find($id);
        if (!$companyModel) {
            return response()->json([
                'message' => 'Company not found'
            ], 404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'valuation' => 'required|numeric|min:0',
            'logo' => 'nullable|string|max:2048',
        ]);

        $companyModel->name = $validated['name'];
        $companyModel->valuation = $validated['valuation'];
        if (array_key_exists('logo', $validated)) {
            $companyModel->logo = $validated['logo'];
        }
        $companyModel->save();

        return response()->json([
            'message' => 'Company updated successfully',
            'company' => [
                'id' => $companyModel->id,
                'code' => $companyModel->code,
                'name' => $companyModel->name,
                'logo' => $companyModel->logo,
                'valuation' => $companyModel->valuation,
                'status' => $companyModel->status,
            ]
        ]);
    }

    /**
     * Mô phỏng verify contract trên BscScan.
     */
    public function verifyContract(Request $request)
    {
        $contractKey = $request->input('contract_key');
        $contractAddress = $request->input('contract_address');
        $apiKey = $request->input('bscscan_api_key');

        if (!$apiKey) {
            return response()->json([
                'message' => 'BscScan API Key is required'
            ], 400);
        }

        // Trả về GUID giả lập của BscScan verify
        $guid = bin2hex(random_bytes(16));

        return response()->json([
            'message' => 'Verification request submitted successfully',
            'guid' => $guid,
            'status' => 'submitted'
        ]);
    }
}
