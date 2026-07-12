<?php

namespace App\Domain\Entities;

class User
{
    private ?int $id;
    private ?string $name;
    private string $walletAddress;
    private ?string $email;
    private ?string $phone;
    private ?string $address;
    private string $kycStatus;
    private bool $isBlacklisted;

    public function __construct(
        ?int $id,
        ?string $name,
        string $walletAddress,
        ?string $email,
        ?string $phone = null,
        ?string $address = null,
        string $kycStatus = 'PENDING',
        bool $isWhitelisted = false,
        bool $isBlacklisted = false
    ) {
        $this->id = $id;
        $this->name = $name;
        $this->walletAddress = strtolower($walletAddress);
        $this->email = $email;
        $this->phone = $phone;
        $this->address = $address;
        $this->kycStatus = $kycStatus;
        $this->isWhitelisted = $isWhitelisted;
        $this->isBlacklisted = $isBlacklisted;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function getWalletAddress(): string
    {
        return $this->walletAddress;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function getPhone(): ?string
    {
        return $this->phone;
    }

    public function getAddress(): ?string
    {
        return $this->address;
    }

    public function getKycStatus(): string
    {
        return $this->kycStatus;
    }

    public function isWhitelisted(): bool
    {
        return $this->isWhitelisted;
    }

    public function isBlacklisted(): bool
    {
        return $this->isBlacklisted;
    }

    public function updateProfile(?string $name, ?string $email, ?string $phone = null, ?string $address = null): void
    {
        $this->name = $name;
        $this->email = $email;
        $this->phone = $phone;
        $this->address = $address;
    }

    public function updateKycStatus(string $status): void
    {
        $this->kycStatus = $status;
    }

    public function updateWhitelisted(bool $status): void
    {
        $this->isWhitelisted = $status;
    }

    public function updateBlacklisted(bool $status): void
    {
        $this->isBlacklisted = $status;
    }
}
