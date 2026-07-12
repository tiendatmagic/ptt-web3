// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IComplianceToken {
    function isWhitelisted(address account) external view returns (bool);
}

contract Marketplace is Ownable {
    using ECDSA for bytes32;

    // System operator wallets for trade matching (Backend Matcher)
    mapping(address => bool) public isOperator;
    
    // Trade fee percentage (basis points, 100 = 1%)
    uint256 public feePercentBps = 50; // 0.5% default
    address public feeTreasury;

    // Prevent replay attack using nonce per account
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public constant BUY_ORDER_TYPEHASH = 
        keccak256("BuyOrder(address buyer,address token,uint256 amount,uint256 price,uint256 nonce,uint256 deadline)");
    bytes32 public constant SELL_ORDER_TYPEHASH = 
        keccak256("SellOrder(address seller,address token,uint256 amount,uint256 price,uint256 nonce,uint256 deadline)");

    event OperatorStatusUpdated(address indexed operator, bool status);
    event FeeConfigUpdated(uint256 feeBps, address indexed treasury);
    
    event TradeSettled(
        address indexed token,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 price,
        uint256 feePaid
    );

    modifier onlyOperator() {
        require(isOperator[msg.sender] || msg.sender == owner(), "Not authorized operator");
        _;
    }

    constructor(address initialOwner, address initialFeeTreasury) Ownable(initialOwner) {
        feeTreasury = initialFeeTreasury;
        isOperator[initialOwner] = true;

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("PTTMarketplace")),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    function setOperator(address operator, bool status) external onlyOwner {
        isOperator[operator] = status;
        emit OperatorStatusUpdated(operator, status);
    }

    function setFeeConfig(uint256 feeBps, address treasury) external onlyOwner {
        require(feeBps <= 1000, "Fee cannot exceed 10%");
        require(treasury != address(0), "Invalid treasury");
        feePercentBps = feeBps;
        feeTreasury = treasury;
        emit FeeConfigUpdated(feeBps, treasury);
    }

    // --- SETTLEMENT EXECUTION ---

    function executeTrade(
        address token,
        address paymentToken,
        address buyer,
        address seller,
        uint256 amount,
        uint256 price, // unit price per token in paymentToken
        uint256 buyerNonce,
        uint256 sellerNonce,
        uint256 buyerDeadline,
        uint256 sellerDeadline,
        bytes calldata buyerSig,
        bytes calldata sellerSig
    ) external onlyOperator {
        require(block.timestamp <= buyerDeadline, "Buyer signature expired");
        require(block.timestamp <= sellerDeadline, "Seller signature expired");
        require(!usedNonces[buyer][buyerNonce], "Buyer nonce already used");
        require(!usedNonces[seller][sellerNonce], "Seller nonce already used");

        // Check compliance whitelists of both buyer and seller for the equity token
        require(IComplianceToken(token).isWhitelisted(buyer), "Buyer not whitelisted for shares");
        require(IComplianceToken(token).isWhitelisted(seller), "Seller not whitelisted for shares");

        // Verify Buyer signature
        bytes32 buyerStructHash = keccak256(
            abi.encode(BUY_ORDER_TYPEHASH, buyer, token, amount, price, buyerNonce, buyerDeadline)
        );
        bytes32 buyerDigest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR, buyerStructHash);
        address recoveredBuyer = buyerDigest.recover(buyerSig);
        require(recoveredBuyer == buyer, "Invalid buyer signature");

        // Verify Seller signature
        bytes32 sellerStructHash = keccak256(
            abi.encode(SELL_ORDER_TYPEHASH, seller, token, amount, price, sellerNonce, sellerDeadline)
        );
        bytes32 sellerDigest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR, sellerStructHash);
        address recoveredSeller = sellerDigest.recover(sellerSig);
        require(recoveredSeller == seller, "Invalid seller signature");

        // Mark nonces as used
        usedNonces[buyer][buyerNonce] = true;
        usedNonces[seller][sellerNonce] = true;

        // Calculate cost for stablecoin transfer
        // cost = (amount * price) / 10**18 (to balance token decimals)
        uint256 cost = (amount * price) / 1e18;
        require(cost > 0, "Trade cost too small");

        uint256 fee = 0;
        uint256 netSellerProceeds = cost;

        if (feePercentBps > 0 && feeTreasury != address(0)) {
            fee = (cost * feePercentBps) / 10000;
            netSellerProceeds = cost - fee;
        }

        // 1. Transfer stablecoin (paymentToken) from Buyer to Seller & Fee Treasury
        IERC20 stablecoin = IERC20(paymentToken);
        require(stablecoin.balanceOf(buyer) >= cost, "Buyer insufficient stablecoin balance");
        
        if (fee > 0) {
            bool feeTransferSuccess = stablecoin.transferFrom(buyer, feeTreasury, fee);
            require(feeTransferSuccess, "Fee payment failed");
        }
        
        bool paymentSuccess = stablecoin.transferFrom(buyer, seller, netSellerProceeds);
        require(paymentSuccess, "Seller payment failed");

        // 2. Transfer EquityToken from Seller to Buyer
        IERC20 equity = IERC20(token);
        require(equity.balanceOf(seller) >= amount, "Seller insufficient shares");
        bool sharesSuccess = equity.transferFrom(seller, buyer, amount);
        require(sharesSuccess, "Shares transfer failed");

        emit TradeSettled(token, buyer, seller, amount, price, fee);
    }
}
