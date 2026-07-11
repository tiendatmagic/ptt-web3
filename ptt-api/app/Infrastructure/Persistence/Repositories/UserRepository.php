<?php

namespace App\Infrastructure\Persistence\Repositories;

use App\Domain\Entities\User;
use App\Domain\Repositories\UserRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\UserModel;
use App\Infrastructure\Persistence\Mappers\UserMapper;

class UserRepository implements UserRepositoryInterface
{
    public function findById(int $id): ?User
    {
        $model = UserModel::find($id);
        return $model ? UserMapper::toEntity($model) : null;
    }

    public function findByWalletAddress(string $walletAddress): ?User
    {
        $model = UserModel::where('wallet_address', strtolower($walletAddress))->first();
        return $model ? UserMapper::toEntity($model) : null;
    }

    public function save(User $user): User
    {
        $model = UserMapper::toModel($user);
        $model->save();
        return UserMapper::toEntity($model);
    }
}
