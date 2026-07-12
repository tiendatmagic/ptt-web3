<?php

namespace App\Infrastructure\Persistence\Mappers;

use App\Domain\Entities\Company;
use App\Infrastructure\Persistence\Eloquent\CompanyModel;

class CompanyMapper
{
    public static function toEntity(CompanyModel $model): Company
    {
        return new Company(
            $model->id,
            $model->uuid,
            $model->code,
            $model->name,
            $model->logo,
            $model->valuation,
            $model->governance_address,
            $model->token_address,
            $model->funding_address,
            $model->marketplace_address,
            $model->status
        );
    }

    public static function toModel(Company $entity): CompanyModel
    {
        $model = new CompanyModel();
        if ($entity->getId()) {
            $model->id = $entity->getId();
            $model->exists = true;
        }
        $model->uuid = $entity->getUuid();
        $model->code = $entity->getCode();
        $model->name = $entity->getName();
        $model->logo = $entity->getLogo();
        $model->valuation = $entity->getValuation();
        $model->governance_address = $entity->getGovernanceAddress();
        $model->token_address = $entity->getTokenAddress();
        $model->funding_address = $entity->getFundingAddress();
        $model->marketplace_address = $entity->getMarketplaceAddress();
        $model->status = $entity->getStatus();
        
        return $model;
    }
}
