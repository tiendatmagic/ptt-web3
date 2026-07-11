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
            $model->code,
            $model->name,
            $model->logo,
            $model->valuation,
            $model->registry_address,
            $model->governance_address,
            $model->token_address,
            $model->treasury_address,
            $model->funding_address,
            $model->distribution_address,
            $model->marketplace_address,
            $model->oracle_address,
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
        $model->code = $entity->getCode();
        $model->name = $entity->getName();
        $model->logo = $entity->getLogo();
        $model->valuation = $entity->getValuation();
        $model->registry_address = $entity->getRegistryAddress();
        $model->governance_address = $entity->getGovernanceAddress();
        $model->token_address = $entity->getTokenAddress();
        $model->treasury_address = $entity->getTreasuryAddress();
        $model->funding_address = $entity->getFundingAddress();
        $model->distribution_address = $entity->getDistributionAddress();
        $model->marketplace_address = $entity->getMarketplaceAddress();
        $model->oracle_address = $entity->getOracleAddress();
        $model->status = $entity->getStatus();
        
        return $model;
    }
}
