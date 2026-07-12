<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FundingDividendController extends Controller
{
    // ==========================================
    // FUNDING ROUNDS APIs
    // ==========================================

    /**
     * Lấy danh sách các vòng gọi vốn.
     */
    public function indexFunding(Request $request)
    {
        $companyId = $request->header('X-Company-Id') ?? $request->query('company_id');

        if (!$companyId) {
            return response()->json(['message' => 'Missing company_id'], 400);
        }

        $rounds = DB::table('funding_rounds')
            ->where('company_id', $companyId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($rounds);
    }

    /**
     * Tạo vòng gọi vốn mới.
     */
    public function storeFunding(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'share_price' => 'required|numeric|gt:0',
            'target_amount' => 'required|numeric|gt:0',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after:start_date',
            'status' => 'nullable|string|in:DRAFT,ACTIVE,COMPLETED,CANCELLED',
            'onchain_round_id' => 'nullable|integer',
        ]);

        $companyId = $request->header('X-Company-Id');
        $status = $request->input('status', 'DRAFT'); // mặc định DRAFT khi tạo thủ công

        $roundId = DB::table('funding_rounds')->insertGetId([
            'company_id' => $companyId,
            'name' => $request->input('name'),
            'share_price' => $request->input('share_price'),
            'target_amount' => $request->input('target_amount'),
            'raised_amount' => 0,
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'status' => $status,
            'onchain_round_id' => $request->input('onchain_round_id'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Funding round created successfully',
            'funding_round_id' => $roundId
        ], 201);
    }

    /**
     * Đồng bộ số tiền huy động của vòng gọi vốn từ blockchain.
     */
    public function syncFunding(Request $request, $id)
    {
        $request->validate([
            'raised_amount' => 'required|numeric|min:0',
            'status' => 'required|string|in:DRAFT,ACTIVE,COMPLETED,CANCELLED'
        ]);

        $companyId = $request->header('X-Company-Id');
        $raisedAmount = $request->input('raised_amount');
        $status = $request->input('status');

        $round = DB::table('funding_rounds')
            ->where('id', $id)
            ->where('company_id', $companyId)
            ->first();

        if (!$round) {
            return response()->json(['message' => 'Funding round not found'], 404);
        }

        DB::table('funding_rounds')
            ->where('id', $id)
            ->update([
                'raised_amount' => $raisedAmount,
                'status' => $status,
                'updated_at' => now()
            ]);

        return response()->json([
            'message' => 'Funding round synced successfully',
            'raised_amount' => $raisedAmount,
            'status' => $status
        ]);
    }

    // ==========================================
    // DIVIDENDS APIs
    // ==========================================

    /**
     * Lấy danh sách các đợt chia cổ tức.
     */
    public function indexDividends(Request $request)
    {
        $companyId = $request->header('X-Company-Id') ?? $request->query('company_id');

        if (!$companyId) {
            return response()->json(['message' => 'Missing company_id'], 400);
        }

        $dividends = DB::table('dividends')
            ->where('company_id', $companyId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($dividends);
    }

    /**
     * Tạo đợt chia cổ tức mới.
     */
    public function storeDividend(Request $request)
    {
        $request->validate([
            'reward_token_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'total_amount' => 'required|numeric|gt:0',
            'snapshot_block' => 'required|integer|gt:0',
            'payment_date' => 'nullable|date',
        ]);

        $companyId = $request->header('X-Company-Id');

        $dividendId = DB::table('dividends')->insertGetId([
            'company_id' => $companyId,
            'reward_token_address' => $request->input('reward_token_address'),
            'total_amount' => $request->input('total_amount'),
            'snapshot_block' => $request->input('snapshot_block'),
            'payment_date' => $request->input('payment_date'),
            'status' => 'DRAFT',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Dividend record created successfully',
            'dividend_id' => $dividendId
        ], 201);
    }

    /**
     * Cập nhật trạng thái đợt cổ tức sau khi deploy/bấm chia on-chain.
     */
    public function syncDividend(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|string|in:DRAFT,APPROVED,ACTIVE,FINISHED,CANCELLED'
        ]);

        $companyId = $request->header('X-Company-Id');
        $status = $request->input('status');

        $dividend = DB::table('dividends')
            ->where('id', $id)
            ->where('company_id', $companyId)
            ->first();

        if (!$dividend) {
            return response()->json(['message' => 'Dividend record not found'], 404);
        }

        DB::table('dividends')
            ->where('id', $id)
            ->update([
                'status' => $status,
                'updated_at' => now()
            ]);

        return response()->json([
            'message' => 'Dividend record status updated successfully',
            'status' => $status
        ]);
    }
}
