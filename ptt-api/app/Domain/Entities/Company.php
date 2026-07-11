<?php

namespace App\Domain\Entities;

class Company
{
    private ?int $id;
    private string $code;
    private string $name;
    private ?string $logo;
    private float $valuation;
    private ?string $registryAddress;
    private ?string $governanceAddress;
    private ?string $tokenAddress;
    private ?string $treasuryAddress;
    private ?string $fundingAddress;
    private ?string $distributionAddress;
    private ?string $marketplaceAddress;
    private ?string $oracleAddress;
    private string $status;

    public function __construct(
        ?int $id,
        string $code,
        string $name,
        ?string $logo,
        float $valuation,
        ?string $registryAddress,
        ?string $governanceAddress,
        ?string $tokenAddress,
        ?string $treasuryAddress,
        ?string $fundingAddress,
        ?string $distributionAddress,
        ?string $marketplaceAddress,
        ?string $oracleAddress,
        string $status = 'ACTIVE'
    ) {
        $this->id = $id;
        $this->code = $code;
        $this->name = $name;
        $this->logo = $logo;
        $this->valuation = $valuation;
        $this->registryAddress = $registryAddress;
        $this->governanceAddress = $governanceAddress;
        $this->tokenAddress = $tokenAddress;
        $this->treasuryAddress = $treasuryAddress;
        $this->fundingAddress = $fundingAddress;
        $this->distributionAddress = $distributionAddress;
        $this->marketplaceAddress = $marketplaceAddress;
        $this->oracleAddress = $oracleAddress;
        $this->status = $status;
    }

    // Getters and Setters

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getLogo(): ?string
    {
        return $this->logo;
    }

    public function getValuation(): float
    {
        return $this->valuation;
    }

    public function getRegistryAddress(): ?string
    {
        return $this->registryAddress;
    }

    public function getGovernanceAddress(): ?string
    {
        return $this->governanceAddress;
    }

    public function getTokenAddress(): ?string
    {
        return $this->tokenAddress;
    }

    public function getTreasuryAddress(): ?string
    {
        return $this->treasuryAddress;
    }

    public function getFundingAddress(): ?string
    {
        return $this->fundingAddress;
    }

    public function getDistributionAddress(): ?string
    {
        return $this->distributionAddress;
    }

    public function getMarketplaceAddress(): ?string
    {
        return $this->marketplaceAddress;
    }

    public function getOracleAddress(): ?string
    {
        return $this->oracleAddress;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function updateValuation(float $valuation): void
    {
        $this->valuation = $valuation;
    }

    public function updateAddresses(array $addresses): void
    {
        if (isset($addresses['registry'])) $this->registryAddress = $addresses['registry'];
        if (isset($addresses['governance'])) $this->governanceAddress = $addresses['governance'];
        if (isset($addresses['token'])) $this->tokenAddress = $addresses['token'];
        if (isset($addresses['treasury'])) $this->treasuryAddress = $addresses['treasury'];
        if (isset($addresses['funding'])) $this->fundingAddress = $addresses['funding'];
        if (isset($addresses['distribution'])) $this->distributionAddress = $addresses['distribution'];
        if (isset($addresses['marketplace'])) $this->marketplaceAddress = $addresses['marketplace'];
        if (isset($addresses['oracle'])) $this->oracleAddress = $addresses['oracle'];
    }
}
