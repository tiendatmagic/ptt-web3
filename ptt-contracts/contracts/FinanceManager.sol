// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IEquityToken {
    function getPastBalanceOf(address account, uint256 blockNumber) external view returns (uint256);
    function getPastTotalSupply(uint256 blockNumber) external view returns (uint256);
    function isWhitelisted(address account) external view returns (bool);
}

contract FinanceManager is Ownable {
    // --- STRUCTURES ---

    struct FundingRound {
        uint256 id;
        string name;
        address shareToken;
        address paymentToken; // stablecoin (USDT/USDC) or address(0) for BNB
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

    struct DividendRound {
        uint256 id;
        string name;
        address shareToken;
        address dividendToken; // stablecoin (USDT/USDC/PTT) or address(0) for BNB
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 checkpointBlock;
        uint256 startTime;
        uint256 endTime;
        bool active;
    }

    // --- VARIABLES ---

    uint256 public roundCount;
    mapping(uint256 => FundingRound) public rounds;
    
    // roundId => investorAddress => purchaseAmount
    mapping(uint256 => mapping(address => uint256)) public investorPurchases;
    // roundId => investorAddress => isWhitelisted
    mapping(uint256 => mapping(address => bool)) public roundWhitelist;

    uint256 public dividendCount;
    mapping(uint256 => DividendRound) public dividends;
    // dividendId => shareholderAddress => claimed
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    // --- EVENTS ---

    event RoundCreated(uint256 indexed roundId, string name, uint256 price);
    event RoundStatusUpdated(uint256 indexed roundId, bool active);
    event SharesPurchased(uint256 indexed roundId, address indexed investor, uint256 amount, uint256 cost);
    event WhitelistUpdated(uint256 indexed roundId, address[] accounts, bool status);

    event DividendRoundCreated(uint256 indexed dividendId, string name, uint256 totalAmount, uint256 checkpointBlock);
    event DividendClaimed(uint256 indexed dividendId, address indexed shareholder, uint256 amount);
    event DividendRoundStatusUpdated(uint256 indexed dividendId, bool active);

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

        // Verify this contract has enough EquityTokens to deliver
        require(
            IERC20(round.shareToken).balanceOf(address(this)) >= tokenAmount,
            "FinanceManager has insufficient EquityTokens to distribute"
        );

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

            // Transfer BNB to Treasury (BoardGovernance Multisig)
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

        // Transfer share tokens to investor
        bool transferSuccess = IERC20(round.shareToken).transfer(msg.sender, tokenAmount);
        require(transferSuccess, "Share transfer to investor failed");

        emit SharesPurchased(roundId, msg.sender, tokenAmount, cost);
    }

    // --- DIVIDEND CONFIGURATION (GOVERNANCE) ---

    // Governance creates dividend round and deposits funds (BNB or ERC20 like USDT/USDC/PTT)
    function createDividendRound(
        string memory name,
        address shareToken,
        address dividendToken,
        uint256 totalAmount,
        uint256 checkpointBlock,
        uint256 startTime,
        uint256 endTime
    ) external payable onlyOwner returns (uint256) {
        require(shareToken != address(0), "Invalid share token");
        require(totalAmount > 0, "Dividend amount must be > 0");
        require(checkpointBlock < block.number, "Checkpoint block must be in the past");
        require(endTime > startTime, "End must be after start");

        // Process dividend token deposit
        if (dividendToken == address(0)) {
            require(msg.value == totalAmount, "Must send exact BNB amount");
        } else {
            require(msg.value == 0, "Do not send BNB for token dividend");
            IERC20 token = IERC20(dividendToken);
            require(token.balanceOf(msg.sender) >= totalAmount, "Insufficient dividend token balance");
            bool success = token.transferFrom(msg.sender, address(this), totalAmount);
            require(success, "Dividend deposit failed");
        }

        dividendCount++;
        uint256 dividendId = dividendCount;

        dividends[dividendId] = DividendRound({
            id: dividendId,
            name: name,
            shareToken: shareToken,
            dividendToken: dividendToken,
            totalAmount: totalAmount,
            claimedAmount: 0,
            checkpointBlock: checkpointBlock,
            startTime: startTime,
            endTime: endTime,
            active: true
        });

        emit DividendRoundCreated(dividendId, name, totalAmount, checkpointBlock);
        return dividendId;
    }

    function setDividendStatus(uint256 dividendId, bool active) external onlyOwner {
        require(dividendId <= dividendCount && dividendId > 0, "Dividend does not exist");
        dividends[dividendId].active = active;
        emit DividendRoundStatusUpdated(dividendId, active);
    }

    // --- CLAIM DIVIDEND (SHAREHOLDERS) ---

    function claimDividend(uint256 dividendId) external {
        require(dividendId <= dividendCount && dividendId > 0, "Dividend does not exist");
        DividendRound storage div = dividends[dividendId];

        require(div.active, "Dividend not active");
        require(block.timestamp >= div.startTime, "Dividend claim period not started");
        require(block.timestamp <= div.endTime, "Dividend claim period ended");
        require(!hasClaimed[dividendId][msg.sender], "Already claimed");

        IEquityToken token = IEquityToken(div.shareToken);
        uint256 userBalance = token.getPastBalanceOf(msg.sender, div.checkpointBlock);
        require(userBalance > 0, "No shares owned at checkpoint");

        uint256 totalShares = token.getPastTotalSupply(div.checkpointBlock);
        require(totalShares > 0, "Total shares must be > 0");

        // Calculate payout: (userBalance * totalAmount) / totalShares
        uint256 claimAmount = (userBalance * div.totalAmount) / totalShares;
        require(claimAmount > 0, "Claim amount is too small");

        hasClaimed[dividendId][msg.sender] = true;
        div.claimedAmount += claimAmount;

        // Process dividend payout
        if (div.dividendToken == address(0)) {
            // Payout BNB
            (bool success, ) = payable(msg.sender).call{value: claimAmount}("");
            require(success, "BNB claim payout failed");
        } else {
            // Payout ERC20 (USDT / USDC / PTT)
            bool success = IERC20(div.dividendToken).transfer(msg.sender, claimAmount);
            require(success, "ERC20 claim payout failed");
        }

        emit DividendClaimed(dividendId, msg.sender, claimAmount);
    }

    // --- EMERGENCY RECLAIM ---

    // Recover leftover/unclaimed dividends after expiration
    function reclaimLeftoverDividend(uint256 dividendId, address recipient) external onlyOwner {
        require(dividendId <= dividendCount && dividendId > 0, "Dividend does not exist");
        DividendRound storage div = dividends[dividendId];
        require(block.timestamp > div.endTime, "Claim period has not ended yet");
        require(recipient != address(0), "Invalid recipient");

        uint256 leftover = div.totalAmount - div.claimedAmount;
        require(leftover > 0, "No leftover funds to reclaim");

        div.claimedAmount = div.totalAmount; // mark as fully claimed to prevent re-withdrawal

        if (div.dividendToken == address(0)) {
            (bool success, ) = payable(recipient).call{value: leftover}("");
            require(success, "Reclaim BNB failed");
        } else {
            bool success = IERC20(div.dividendToken).transfer(recipient, leftover);
            require(success, "Reclaim ERC20 failed");
        }
    }

    // Fallback to receive BNB
    receive() external payable {}
}
