// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IEquityToken {
    function mint(address to, uint256 amount) external;
    function isWhitelisted(address account) external view returns (bool);
}

contract FundingManager is Ownable {
    struct FundingRound {
        uint256 id;
        string name;
        address shareToken;
        address paymentToken; // stablecoin (e.g. USDT) or address(0) for BNB
        address treasury;
        uint256 price; // Share price (calculated in the smallest unit of paymentToken)
        uint256 maxSupply; // Maximum number of shares to be sold
        uint256 soldAmount; // Sold shares
        uint256 startTime;
        uint256 endTime;
        uint256 minPurchase; // Minimum purchase limit per wallet (token amount)
        uint256 maxPurchase; // Maximum purchase limit per wallet (token amount)
        bool isWhitelistOnly;
        bool active;
    }

    uint256 public roundCount;
    mapping(uint256 => FundingRound) public rounds;
    
    // roundId => investorAddress => purchaseAmount
    mapping(uint256 => mapping(address => uint256)) public investorPurchases;
    // roundId => investorAddress => isWhitelisted
    mapping(uint256 => mapping(address => bool)) public roundWhitelist;

    event RoundCreated(uint256 indexed roundId, string name, uint256 price);
    event RoundStatusUpdated(uint256 indexed roundId, bool active);
    event SharesPurchased(uint256 indexed roundId, address indexed investor, uint256 amount, uint256 cost);
    event WhitelistUpdated(uint256 indexed roundId, address[] accounts, bool status);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // --- FUNDING ROUND CONFIGURATION (GOVERNANCE) ---

    function createFundingRound(
        string memory name,
        address shareToken,
        address paymentToken,
        address treasury,
        uint256 price,
        uint256 maxSupply,
        uint256 startTime,
        uint256 endTime,
        uint256 minPurchase,
        uint256 maxPurchase,
        bool isWhitelistOnly
    ) external onlyOwner returns (uint256) {
        require(shareToken != address(0) && treasury != address(0), "Invalid addresses");
        require(endTime > startTime, "End must be after start");
        require(price > 0 && maxSupply > 0, "Invalid pricing or supply");

        roundCount++;
        uint256 roundId = roundCount;

        rounds[roundId] = FundingRound({
            id: roundId,
            name: name,
            shareToken: shareToken,
            paymentToken: paymentToken,
            treasury: treasury,
            price: price,
            maxSupply: maxSupply,
            soldAmount: 0,
            startTime: startTime,
            endTime: endTime,
            minPurchase: minPurchase,
            maxPurchase: maxPurchase,
            isWhitelistOnly: isWhitelistOnly,
            active: true
        });

        emit RoundCreated(roundId, name, price);
        return roundId;
    }

    function setRoundStatus(uint256 roundId, bool active) external onlyOwner {
        require(roundId <= roundCount && roundId > 0, "Round does not exist");
        rounds[roundId].active = active;
        emit RoundStatusUpdated(roundId, active);
    }

    function updateRoundWhitelist(
        uint256 roundId,
        address[] calldata accounts,
        bool status
    ) external onlyOwner {
        require(roundId <= roundCount && roundId > 0, "Round does not exist");
        for (uint256 i = 0; i < accounts.length; i++) {
            roundWhitelist[roundId][accounts[i]] = status;
        }
        emit WhitelistUpdated(roundId, accounts, status);
    }

    // --- BUY SHARES (INVESTORS) ---

    function buyShares(uint256 roundId, uint256 tokenAmount) external payable {
        require(roundId <= roundCount && roundId > 0, "Round does not exist");
        FundingRound storage round = rounds[roundId];
        
        require(round.active, "Round not active");
        require(block.timestamp >= round.startTime, "Round not started");
        require(block.timestamp <= round.endTime, "Round ended");
        require(round.soldAmount + tokenAmount <= round.maxSupply, "Exceeds round max supply");

        // Check funding round whitelist
        if (round.isWhitelistOnly) {
            require(roundWhitelist[roundId][msg.sender], "Not whitelisted in this round");
        }

        // Check compliance whitelist on the main token
        require(IEquityToken(round.shareToken).isWhitelisted(msg.sender), "Not whitelisted for equity holding");

        // Check purchase limits
        uint256 totalPurchased = investorPurchases[roundId][msg.sender] + tokenAmount;
        if (round.minPurchase > 0) {
            require(totalPurchased >= round.minPurchase, "Under minimum purchase limit");
        }
        if (round.maxPurchase > 0) {
            require(totalPurchased <= round.maxPurchase, "Exceeds maximum purchase limit");
        }

        // Calculate cost (assuming tokenAmount has 18 decimals)
        // Cost = (tokenAmount * price) / 10**18 (to balance decimals)
        uint256 cost = (tokenAmount * round.price) / 1e18;
        require(cost > 0, "Cost is too small");

        investorPurchases[roundId][msg.sender] = totalPurchased;
        round.soldAmount += tokenAmount;

        // Process payment
        if (round.paymentToken == address(0)) {
            // Pay with BNB
            require(msg.value >= cost, "Insufficient BNB sent");
            
            // Refund excess BNB
            if (msg.value > cost) {
                payable(msg.sender).transfer(msg.value - cost);
            }

            // Transfer BNB to Treasury
            (bool success, ) = round.treasury.call{value: cost}("");
            require(success, "BNB transfer to treasury failed");
        } else {
            // Pay with ERC20 (USDT / USDC)
            require(msg.value == 0, "Do not send BNB for token payment");
            IERC20 token = IERC20(round.paymentToken);
            require(token.balanceOf(msg.sender) >= cost, "Insufficient stablecoin balance");
            
            // Transfer stablecoin directly to Treasury
            bool success = token.transferFrom(msg.sender, round.treasury, cost);
            require(success, "Token transfer to treasury failed");
        }

        // Mint share tokens to investor (FundingManager needs minting permission)
        IEquityToken(round.shareToken).mint(msg.sender, tokenAmount);

        emit SharesPurchased(roundId, msg.sender, tokenAmount, cost);
    }
}
