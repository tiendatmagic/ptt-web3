<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\Entities\Company;
use App\Domain\Repositories\CompanyRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\CompanyModel;
use App\Infrastructure\Persistence\Mappers\CompanyMapper;

class CompanyRepository implements CompanyRepositoryInterface
{
    public function findById(int $id): ?Company
    {
        $model = CompanyModel::find($id);
        return $model ? CompanyMapper::toEntity($model) : null;
    }

    public function findByCode(string $code): ?Company
    {
        $model = CompanyModel::where('code', $code)->first();
        return $model ? CompanyMapper::toEntity($model) : null;
    }

    public function save(Company $company): Company
    {
        $model = CompanyMapper::toModel($company);
        $model->save();
        return CompanyMapper::toEntity($model);
    }

    public function all(): array
    {
        return CompanyModel::all()->map(function ($model) {
            return CompanyMapper::toEntity($model);
        })->toArray();
    }
}
