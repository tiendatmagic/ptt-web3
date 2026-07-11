<?php

namespace App\Domain\Entities;

class User
{
    private ?int $id;
    private ?string $name;
    private string $walletAddress;
    private ?string $email;
    private string $kycStatus;
    private bool $isWhitelisted;

    public function __construct(
        ?int $id,
        ?string $name,
        string $walletAddress,
        ?string $email,
        string $kycStatus = 'PENDING',
        bool $isWhitelisted = false
    ) {
        $this->id = $id;
        $this->name = $name;
        $this->walletAddress = strtolower($walletAddress);
        $this->email = $email;
        $this->kycStatus = $kycStatus;
        $this->isWhitelisted = $isWhitelisted;
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

    public function getKycStatus(): string
    {
        return $this->kycStatus;
    }

    public function isWhitelisted(): bool
    {
        return $this->isWhitelisted;
    }

    public function updateProfile(?string $name, ?string $email): void
    {
        $this->name = $name;
        $this->email = $email;
    }

    public function updateKycStatus(string $status): void
    {
        $this->kycStatus = $status;
    }

    public function updateWhitelisted(bool $status): void
    {
        $this->isWhitelisted = $status;
    }
}
