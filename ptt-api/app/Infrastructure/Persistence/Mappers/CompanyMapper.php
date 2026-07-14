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
            $model->chain_id,
            $model->governance_address,
            $model->token_address,
            $model->funding_address,
            $model->marketplace_address,
            $model->token_name,
            $model->token_symbol,
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
        $model->chain_id = $entity->getChainId();
        $model->governance_address = $entity->getGovernanceAddress();
        $model->token_address = $entity->getTokenAddress();
        $model->funding_address = $entity->getFundingAddress();
        $model->marketplace_address = $entity->getMarketplaceAddress();
        $model->token_name = $entity->getTokenName();
        $model->token_symbol = $entity->getTokenSymbol();
        $model->status = $entity->getStatus();
        
        return $model;
    }
}
