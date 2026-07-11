<?php

namespace App\Domain\Repositories;

use App\Domain\Entities\User;

interface UserRepositoryInterface
{
    public function findById(int $id): ?User;
    public function findByWalletAddress(string $walletAddress): ?User;
    public function save(User $user): User;
}
