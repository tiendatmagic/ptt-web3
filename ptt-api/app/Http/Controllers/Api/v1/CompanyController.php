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
                'uuid' => $company->getUuid(),
                'code' => $company->getCode(),
                'name' => $company->getName(),
                'logo' => $company->getLogo(),
                'valuation' => $company->getValuation(),
                'chain_id' => $company->getChainId(),
                'governance_address' => $company->getGovernanceAddress(),
                'token_address' => $company->getTokenAddress(),
                'funding_address' => $company->getFundingAddress(),
                'marketplace_address' => $company->getMarketplaceAddress(),
                'token_name' => $company->getTokenName(),
                'token_symbol' => $company->getTokenSymbol(),
                'saved_tokens' => $company->getSavedTokens() ?: [],
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
            'uuid' => $company->getUuid(),
            'code' => $company->getCode(),
            'name' => $company->getName(),
            'logo' => $company->getLogo(),
            'valuation' => $company->getValuation(),
            'chain_id' => $company->getChainId(),
            'governance_address' => $company->getGovernanceAddress(),
            'token_address' => $company->getTokenAddress(),
            'funding_address' => $company->getFundingAddress(),
            'marketplace_address' => $company->getMarketplaceAddress(),
            'token_name' => $company->getTokenName(),
            'token_symbol' => $company->getTokenSymbol(),
            'saved_tokens' => $company->getSavedTokens() ?: [],
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
            // 1. Tạo Company Entity (truyền uuid = null để DB tự sinh)
            $company = new Company(
                null,
                null,
                $request->input('code'),
                $request->input('name'),
                $request->input('logo'),
                $request->input('valuation'),
                $request->input('governance_address'),
                $request->input('token_address'),
                $request->input('funding_address'),
                $request->input('marketplace_address'),
                $request->input('token_name') ?: $request->input('name'),
                $request->input('token_symbol') ?: $request->input('code')
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
                'uuid' => $company->getUuid(),
                'code' => $company->getCode(),
                'name' => $company->getName(),
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
            'governance_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'token_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'funding_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'marketplace_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'chain_id' => 'nullable|integer',
        ]);

        if (isset($validated['chain_id'])) {
            $newChainId = (int) $validated['chain_id'];
            if (!empty($companyModel->chain_id) && (int)$companyModel->chain_id !== $newChainId) {
                return response()->json([
                    'message' => "Cannot modify or remove chain ID once it has been configured."
                ], 400);
            }
            $companyModel->chain_id = $newChainId;
        }

        $addressFields = ['governance_address', 'token_address', 'funding_address', 'marketplace_address'];
        foreach ($addressFields as $key) {
            if (!array_key_exists($key, $validated)) {
                continue;
            }
            $value = $validated[$key];

            // Chống scam: Nếu địa chỉ hiện tại trong DB đã có giá trị, không cho phép sửa đổi hoặc gỡ bỏ (trở thành null hoặc rỗng)
            if (!empty($companyModel->$key) && $companyModel->$key !== $value) {
                return response()->json([
                    'message' => "Cannot modify or remove " . str_replace('_', ' ', $key) . " once it has been linked."
                ], 400);
            }

            // Chống copy/scam chéo: Đảm bảo địa chỉ liên kết mới là duy nhất trên toàn hệ thống (không trùng với bất kỳ công ty nào khác)
            if (!empty($value)) {
                $exists = DB::table('companies')
                    ->where('id', '!=', $id)
                    ->where(function ($query) use ($value) {
                        $query->where('governance_address', $value)
                            ->orWhere('token_address', $value)
                            ->orWhere('funding_address', $value)
                            ->orWhere('marketplace_address', $value);
                    })
                    ->exists();

                if ($exists) {
                    return response()->json([
                        'message' => "The contract address {$value} has already been linked to another company."
                    ], 422);
                }
            }
            
            $companyModel->$key = $value;
        }
        $companyModel->save();

        return response()->json([
            'message' => 'Contract addresses updated successfully',
            'company' => [
                'id' => $companyModel->id,
                'uuid' => $companyModel->uuid,
                'code' => $companyModel->code,
                'name' => $companyModel->name,
                'logo' => $companyModel->logo,
                'valuation' => (float) $companyModel->valuation,
                'chain_id' => $companyModel->chain_id,
                'governance_address' => $companyModel->governance_address,
                'token_address' => $companyModel->token_address,
                'funding_address' => $companyModel->funding_address,
                'marketplace_address' => $companyModel->marketplace_address,
                'token_name' => $companyModel->token_name,
                'token_symbol' => $companyModel->token_symbol,
                'saved_tokens' => $companyModel->saved_tokens ?: [],
                'status' => $companyModel->status,
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
            'token_name' => 'nullable|string|max:255',
            'token_symbol' => 'nullable|string|max:50',
        ]);

        $hasContracts = (
            $companyModel->governance_address ||
            $companyModel->token_address ||
            $companyModel->funding_address ||
            $companyModel->marketplace_address
        );

        if ($hasContracts) {
            if (isset($validated['token_name']) && $companyModel->token_name !== $validated['token_name']) {
                return response()->json(['message' => 'Cannot modify Token Name once contracts are deployed'], 400);
            }
            if (isset($validated['token_symbol']) && $companyModel->token_symbol !== $validated['token_symbol']) {
                return response()->json(['message' => 'Cannot modify Token Symbol once contracts are deployed'], 400);
            }
        } else {
            if (isset($validated['token_name'])) {
                $companyModel->token_name = $validated['token_name'];
            }
            if (isset($validated['token_symbol'])) {
                $companyModel->token_symbol = $validated['token_symbol'];
            }
        }

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
                'uuid' => $companyModel->uuid,
                'code' => $companyModel->code,
                'name' => $companyModel->name,
                'logo' => $companyModel->logo,
                'valuation' => (float) $companyModel->valuation,
                'chain_id' => $companyModel->chain_id,
                'governance_address' => $companyModel->governance_address,
                'token_address' => $companyModel->token_address,
                'funding_address' => $companyModel->funding_address,
                'marketplace_address' => $companyModel->marketplace_address,
                'token_name' => $companyModel->token_name,
                'token_symbol' => $companyModel->token_symbol,
                'saved_tokens' => $companyModel->saved_tokens ?: [],
                'status' => $companyModel->status,
            ]
        ]);
    }

    /**
     * Xóa doanh nghiệp nháp (chưa liên kết contracts).
     */
    public function destroy(Request $request, int $id)
    {
        $user = $request->user();

        // 1. Tìm doanh nghiệp
        $companyModel = \App\Infrastructure\Persistence\Eloquent\CompanyModel::find($id);
        if (!$companyModel) {
            return response()->json([
                'message' => 'Company not found'
            ], 404);
        }

        // 2. Kiểm tra quyền hạn: Chỉ Chủ doanh nghiệp (Owner) mới có quyền xóa
        $isOwner = DB::table('staffs')
            ->join('roles', 'staffs.role_id', '=', 'roles.id')
            ->where('staffs.user_id', $user->id)
            ->where('staffs.company_id', $id)
            ->where('roles.name', 'Owner')
            ->exists();

        if (!$isOwner) {
            return response()->json([
                'message' => 'Unauthorized: Only the company Owner can delete this company'
            ], 403);
        }

        // 3. Kiểm tra xem doanh nghiệp đã liên kết Smart Contracts hay chưa
        if (
            $companyModel->governance_address ||
            $companyModel->token_address ||
            $companyModel->funding_address ||
            $companyModel->marketplace_address
        ) {
            return response()->json([
                'message' => 'Cannot delete a company that has already been linked to on-chain Smart Contracts'
            ], 400);
        }

        // 4. Xóa doanh nghiệp (các bảng roles và staffs liên kết sẽ tự động bị xóa cascade nhờ ràng buộc khóa ngoại trong DB)
        $companyModel->delete();

        return response()->json([
            'message' => 'Company draft deleted successfully'
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

    /**
     * Cập nhật danh sách Token ERC20 đã lưu của doanh nghiệp.
     */
    public function updateSavedTokens(Request $request, int $id)
    {
        $companyModel = \App\Infrastructure\Persistence\Eloquent\CompanyModel::find($id);
        if (!$companyModel) {
            return response()->json([
                'message' => 'Company not found'
            ], 404);
        }

        // Validate đầu vào
        $validated = $request->validate([
            'saved_tokens' => 'present|array',
            'saved_tokens.*.address' => 'required|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'saved_tokens.*.symbol' => 'required|string|max:50',
            'saved_tokens.*.name' => 'required|string|max:255',
            'saved_tokens.*.decimals' => 'required|integer|min:0|max:255',
        ]);

        $companyModel->saved_tokens = $validated['saved_tokens'];
        $companyModel->save();

        return response()->json([
            'message' => 'Saved ERC20 tokens updated successfully',
            'company' => [
                'id' => $companyModel->id,
                'uuid' => $companyModel->uuid,
                'code' => $companyModel->code,
                'name' => $companyModel->name,
                'logo' => $companyModel->logo,
                'valuation' => (float) $companyModel->valuation,
                'chain_id' => $companyModel->chain_id,
                'governance_address' => $companyModel->governance_address,
                'token_address' => $companyModel->token_address,
                'funding_address' => $companyModel->funding_address,
                'marketplace_address' => $companyModel->marketplace_address,
                'token_name' => $companyModel->token_name,
                'token_symbol' => $companyModel->token_symbol,
                'saved_tokens' => $companyModel->saved_tokens ?: [],
                'status' => $companyModel->status,
            ]
        ]);
    }
}
