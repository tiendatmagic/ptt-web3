<?php

namespace App\Domain\Entities;

class Company
{
    private ?int $id;
    private ?string $uuid;
    private string $code;
    private string $name;
    private ?string $logo;
    private float $valuation;
    private ?int $chainId;
    private ?string $governanceAddress;
    private ?string $tokenAddress;
    private ?string $fundingAddress;
    private ?string $marketplaceAddress;
    private ?string $tokenName;
    private ?string $tokenSymbol;
    private ?array $savedTokens;
    private string $status;

    public function __construct(
        ?int $id,
        ?string $uuid,
        string $code,
        string $name,
        ?string $logo,
        float $valuation,
        ?int $chainId,
        ?string $governanceAddress,
        ?string $tokenAddress,
        ?string $fundingAddress,
        ?string $marketplaceAddress,
        ?string $tokenName = null,
        ?string $tokenSymbol = null,
        ?array $savedTokens = null,
        string $status = 'ACTIVE'
    ) {
        $this->id = $id;
        $this->uuid = $uuid;
        $this->code = $code;
        $this->name = $name;
        $this->logo = $logo;
        $this->valuation = $valuation;
        $this->chainId = $chainId;
        $this->governanceAddress = $governanceAddress;
        $this->tokenAddress = $tokenAddress;
        $this->fundingAddress = $fundingAddress;
        $this->marketplaceAddress = $marketplaceAddress;
        $this->tokenName = $tokenName;
        $this->tokenSymbol = $tokenSymbol;
        $this->savedTokens = $savedTokens;
        $this->status = $status;
    }

    // Getters and Setters

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUuid(): ?string
    {
        return $this->uuid;
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

    public function getChainId(): ?int
    {
        return $this->chainId;
    }

    public function getGovernanceAddress(): ?string
    {
        return $this->governanceAddress;
    }

    public function getTokenAddress(): ?string
    {
        return $this->tokenAddress;
    }

    public function getFundingAddress(): ?string
    {
        return $this->fundingAddress;
    }

    public function getMarketplaceAddress(): ?string
    {
        return $this->marketplaceAddress;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getTokenName(): ?string
    {
        return $this->tokenName;
    }

    public function getTokenSymbol(): ?string
    {
        return $this->tokenSymbol;
    }

    public function updateTokenInfo(?string $tokenName, ?string $tokenSymbol): void
    {
        $this->tokenName = $tokenName;
        $this->tokenSymbol = $tokenSymbol;
    }

    public function updateValuation(float $valuation): void
    {
        $this->valuation = $valuation;
    }

    public function updateAddresses(array $addresses): void
    {
        if (isset($addresses['governance'])) $this->governanceAddress = $addresses['governance'];
        if (isset($addresses['token'])) $this->tokenAddress = $addresses['token'];
        if (isset($addresses['funding'])) $this->fundingAddress = $addresses['funding'];
        if (isset($addresses['marketplace'])) $this->marketplaceAddress = $addresses['marketplace'];
    }

    public function getSavedTokens(): ?array
    {
        return $this->savedTokens;
    }

    public function updateSavedTokens(?array $savedTokens): void
    {
        $this->savedTokens = $savedTokens;
    }
}
