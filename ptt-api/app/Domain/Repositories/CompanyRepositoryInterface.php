<?php

namespace App\Domain\Repositories;

use App\Domain\Entities\Company;

interface CompanyRepositoryInterface
{
    public function findById(int $id): ?Company;
    public function findByCode(string $code): ?Company;
    public function save(Company $company): Company;
    public function all(): array;
}
