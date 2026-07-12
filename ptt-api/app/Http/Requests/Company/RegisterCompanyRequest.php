<?php

namespace App\Http\Requests\Company;

use Illuminate\Foundation\Http\FormRequest;

class RegisterCompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Phân quyền sẽ được handle ở middleware
    }

    public function rules(): array
    {
        return [
            'code' => 'required|string|max:50|unique:companies,code',
            'name' => 'required|string|max:255',
            'logo' => 'nullable|string',
            'valuation' => 'required|numeric|min:0',
            'registry_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'governance_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'token_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'funding_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'marketplace_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
            'oracle_address' => 'nullable|string|regex:/^0x[a-fA-F0-9]{40}$/',
        ];
    }
}
