<?php

namespace App\Infrastructure\Persistence\Mappers;

use App\Domain\Entities\User;
use App\Infrastructure\Persistence\Eloquent\UserModel;

class UserMapper
{
    public static function toEntity(UserModel $model): User
    {
        return new User(
            $model->id,
            $model->name,
            $model->wallet_address,
            $model->email,
            $model->kyc_status,
            $model->is_whitelisted
        );
    }

    public static function toModel(User $entity): UserModel
    {
        $model = new UserModel();
        if ($entity->getId()) {
            $model->id = $entity->getId();
            $model->exists = true;
        }
        $model->name = $entity->getName();
        $model->wallet_address = strtolower($entity->getWalletAddress());
        $model->email = $entity->getEmail();
        $model->kyc_status = $entity->getKycStatus();
        $model->is_whitelisted = $entity->isWhitelisted();
        
        return $model;
    }
}
