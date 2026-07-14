// SPDX-License-Identifier: MIT

pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IBoardGovernance {
    function isMember(address member) external view returns (bool);
}

interface IComplianceToken {
    function isWhitelisted(address account) external view returns (bool);
}

contract Marketplace is Ownable, IERC721Receiver, IERC1155Receiver {
    using ECDSA for bytes32;

    struct TradeParams {
        address token;
        address paymentToken;
        address buyer;
        address seller;
        uint256 amount;
        uint256 price;
        uint256 buyerNonce;
        uint256 sellerNonce;
        uint256 buyerDeadline;
        uint256 sellerDeadline;
        bytes buyerSig;
        bytes sellerSig;
    }

    mapping(address => bool) public isOperator;

    uint256 public feePercentBps = 50;
    address public feeTreasury;

    mapping(address => mapping(uint256 => bool)) public usedNonces;

    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public constant BUY_ORDER_TYPEHASH =
        keccak256(
            "BuyOrder(address buyer,address token,uint256 amount,uint256 price,uint256 nonce,uint256 deadline)"
        );
    bytes32 public constant SELL_ORDER_TYPEHASH =
        keccak256(
            "SellOrder(address seller,address token,uint256 amount,uint256 price,uint256 nonce,uint256 deadline)"
        );

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
        require(
            isOperator[msg.sender] || msg.sender == owner(),
            "Not authorized operator"
        );
        _;
    }

    constructor(
        address initialOwner,
        address initialFeeTreasury
    ) Ownable(initialOwner) {
        feeTreasury = initialFeeTreasury;
        isOperator[initialOwner] = true;

        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
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

    function executeTrade(TradeParams calldata p) external {
        require(block.timestamp <= p.buyerDeadline, "Buyer signature expired");
        require(
            block.timestamp <= p.sellerDeadline,
            "Seller signature expired"
        );
        require(!usedNonces[p.buyer][p.buyerNonce], "Buyer nonce already used");
        require(
            !usedNonces[p.seller][p.sellerNonce],
            "Seller nonce already used"
        );

        require(
            IComplianceToken(p.token).isWhitelisted(p.seller),
            "Seller not whitelisted for shares"
        );

        {
            bytes32 buyerStructHash = keccak256(
                abi.encode(
                    BUY_ORDER_TYPEHASH,
                    p.buyer,
                    p.token,
                    p.amount,
                    p.price,
                    p.buyerNonce,
                    p.buyerDeadline
                )
            );
            bytes32 buyerDigest = MessageHashUtils.toTypedDataHash(
                DOMAIN_SEPARATOR,
                buyerStructHash
            );
            require(
                buyerDigest.recover(p.buyerSig) == p.buyer,
                "Invalid buyer signature"
            );
        }

        {
            bytes32 sellerStructHash = keccak256(
                abi.encode(
                    SELL_ORDER_TYPEHASH,
                    p.seller,
                    p.token,
                    p.amount,
                    p.price,
                    p.sellerNonce,
                    p.sellerDeadline
                )
            );
            bytes32 sellerDigest = MessageHashUtils.toTypedDataHash(
                DOMAIN_SEPARATOR,
                sellerStructHash
            );
            require(
                sellerDigest.recover(p.sellerSig) == p.seller,
                "Invalid seller signature"
            );
        }

        usedNonces[p.buyer][p.buyerNonce] = true;
        usedNonces[p.seller][p.sellerNonce] = true;

        uint256 cost = (p.amount * p.price) / 1e18;
        require(cost > 0, "Trade cost too small");

        uint256 fee = 0;
        uint256 netSellerProceeds = cost;

        if (feePercentBps > 0 && feeTreasury != address(0)) {
            fee = (cost * feePercentBps) / 10000;
            netSellerProceeds = cost - fee;
        }

        IERC20 stablecoin = IERC20(p.paymentToken);
        require(
            stablecoin.balanceOf(p.buyer) >= cost,
            "Buyer insufficient stablecoin balance"
        );

        if (fee > 0) {
            require(
                stablecoin.transferFrom(p.buyer, feeTreasury, fee),
                "Fee payment failed"
            );
        }

        require(
            stablecoin.transferFrom(p.buyer, p.seller, netSellerProceeds),
            "Seller payment failed"
        );

        IERC20 equity = IERC20(p.token);
        require(
            equity.balanceOf(p.seller) >= p.amount,
            "Seller insufficient shares"
        );
        require(
            equity.transferFrom(p.seller, p.buyer, p.amount),
            "Shares transfer failed"
        );

        emit TradeSettled(p.token, p.buyer, p.seller, p.amount, p.price, fee);
    }

    function rescueNative(
        address payable recipient,
        uint256 amount
    ) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function rescueERC20(
        address token,
        address recipient,
        uint256 amount
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(recipient != address(0), "Invalid recipient");
        require(IERC20(token).transfer(recipient, amount), "Transfer failed");
    }

    function rescueERC721(
        address token,
        address recipient,
        uint256 tokenId
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(recipient != address(0), "Invalid recipient");
        IERC721(token).safeTransferFrom(address(this), recipient, tokenId);
    }

    function rescueERC1155(
        address token,
        address recipient,
        uint256 tokenId,
        uint256 amount,
        bytes calldata data
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(recipient != address(0), "Invalid recipient");
        IERC1155(token).safeTransferFrom(
            address(this),
            recipient,
            tokenId,
            amount,
            data
        );
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external pure override returns (bool) {
        return
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }
}
