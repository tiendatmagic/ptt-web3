// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IEquityToken {
    function getPastBalanceOf(address account, uint256 blockNumber) external view returns (uint256);
    function getPastTotalSupply(uint256 blockNumber) external view returns (uint256);
    function isWhitelisted(address account) external view returns (bool);
}

contract FinanceManager is Ownable {

    struct FundingRound {
        uint256 id;
        string name;
        address shareToken;
        address paymentToken;
        address treasury;
        uint256 price;
        uint256 maxSupply;
        uint256 soldAmount;
        uint256 startTime;
        uint256 endTime;
        uint256 minPurchase;
        uint256 maxPurchase;
        bool isWhitelistOnly;
        bool active;
    }

    struct RoundParams {
        string name;
        address shareToken;
        address paymentToken;
        address treasury;
        uint256 price;
        uint256 maxSupply;
        uint256 startTime;
        uint256 endTime;
        uint256 minPurchase;
        uint256 maxPurchase;
        bool isWhitelistOnly;
    }

    struct DividendRound {
        uint256 id;
        string name;
        address shareToken;
        address dividendToken;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 checkpointBlock;
        uint256 startTime;
        uint256 endTime;
        bool active;
    }

    uint256 public roundCount;
    mapping(uint256 => FundingRound) private _rounds;
    
    mapping(uint256 => mapping(address => uint256)) public investorPurchases;
    mapping(uint256 => mapping(address => bool)) public roundWhitelist;

    uint256 public dividendCount;
    mapping(uint256 => DividendRound) private _dividends;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event RoundCreated(uint256 indexed roundId, string name, uint256 price);
    event RoundStatusUpdated(uint256 indexed roundId, bool active);
    event SharesPurchased(uint256 indexed roundId, address indexed investor, uint256 amount, uint256 cost);
    event WhitelistUpdated(uint256 indexed roundId, address[] accounts, bool status);

    event DividendRoundCreated(uint256 indexed dividendId, string name, uint256 totalAmount, uint256 checkpointBlock);
    event DividendClaimed(uint256 indexed dividendId, address indexed shareholder, uint256 amount);
    event DividendRoundStatusUpdated(uint256 indexed dividendId, bool active);

    address public operator;

    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event RoundPriceUpdated(uint256 indexed roundId, uint256 newPrice);

    modifier onlyOwnerOrOperator() {
        require(msg.sender == owner() || msg.sender == operator, "Not owner or operator");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function rounds(uint256 roundId) external view returns (FundingRound memory) {
        return _rounds[roundId];
    }

    function dividends(uint256 dividendId) external view returns (DividendRound memory) {
        return _dividends[dividendId];
    }

    function setOperator(address _operator) external onlyOwner {
        address oldOperator = operator;
        operator = _operator;
        emit OperatorUpdated(oldOperator, _operator);
    }

    function updateRoundPrice(uint256 roundId, uint256 newPrice) external onlyOwnerOrOperator {
        require(roundId <= roundCount && roundId > 0, "Round does not exist");
        require(newPrice > 0, "Invalid price");
        _rounds[roundId].price = newPrice;
        emit RoundPriceUpdated(roundId, newPrice);
    }

    function createFundingRound(RoundParams calldata p) external onlyOwner returns (uint256) {
        require(p.shareToken != address(0) && p.treasury != address(0), "Invalid addresses");
        require(p.endTime > p.startTime, "End must be after start");
        require(p.price > 0 && p.maxSupply > 0, "Invalid pricing or supply");

        roundCount++;
        uint256 roundId = roundCount;

        _rounds[roundId] = FundingRound({
            id: roundId,
            name: p.name,
            shareToken: p.shareToken,
            paymentToken: p.paymentToken,
            treasury: p.treasury,
            price: p.price,
            maxSupply: p.maxSupply,
            soldAmount: 0,
            startTime: p.startTime,
            endTime: p.endTime,
            minPurchase: p.minPurchase,
            maxPurchase: p.maxPurchase,
            isWhitelistOnly: p.isWhitelistOnly,
            active: true
        });

        emit RoundCreated(roundId, p.name, p.price);
        return roundId;
    }

    function setRoundStatus(uint256 roundId, bool active) external onlyOwner {
        require(roundId <= roundCount && roundId > 0, "Round does not exist");
        _rounds[roundId].active = active;
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

    function _processPayment(
        address paymentToken,
        address treasury,
        uint256 cost
    ) private {
        if (paymentToken == address(0)) {
            require(msg.value >= cost, "Insufficient BNB sent");
            if (msg.value > cost) {
                (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - cost}("");
                require(refundSuccess, "Refund failed");
            }
            (bool treasurySuccess, ) = treasury.call{value: cost}("");
            require(treasurySuccess, "BNB transfer to treasury failed");
        } else {
            require(msg.value == 0, "Do not send BNB for token payment");
            IERC20 token = IERC20(paymentToken);
            require(token.balanceOf(msg.sender) >= cost, "Insufficient stablecoin balance");
            require(token.transferFrom(msg.sender, treasury, cost), "Token transfer to treasury failed");
        }
    }

    function _depositDividend(address dividendToken, uint256 totalAmount) private {
        if (dividendToken == address(0)) {
            require(msg.value == totalAmount, "Must send exact BNB amount");
        } else {
            require(msg.value == 0, "Do not send BNB for token dividend");
            IERC20 token = IERC20(dividendToken);
            require(token.balanceOf(msg.sender) >= totalAmount, "Insufficient dividend token balance");
            require(token.transferFrom(msg.sender, address(this), totalAmount), "Dividend deposit failed");
        }
    }

    function buyShares(uint256 roundId, uint256 tokenAmount) external payable {
        require(roundId <= roundCount && roundId > 0, "Round does not exist");
        
        {
            require(_rounds[roundId].active, "Round not active");
            require(block.timestamp >= _rounds[roundId].startTime, "Round not started");
            require(block.timestamp <= _rounds[roundId].endTime, "Round ended");
            require(_rounds[roundId].soldAmount + tokenAmount <= _rounds[roundId].maxSupply, "Exceeds round max supply");
        }

        {
            address shareToken = _rounds[roundId].shareToken;
            require(
                IERC20(shareToken).balanceOf(address(this)) >= tokenAmount,
                "FinanceManager has insufficient EquityTokens to distribute"
            );
            if (_rounds[roundId].isWhitelistOnly) {
                require(roundWhitelist[roundId][msg.sender], "Not whitelisted in this round");
            }
            require(IEquityToken(shareToken).isWhitelisted(msg.sender), "Not whitelisted for equity holding");
        }

        {
            uint256 totalPurchased = investorPurchases[roundId][msg.sender] + tokenAmount;
            uint256 minP = _rounds[roundId].minPurchase;
            uint256 maxP = _rounds[roundId].maxPurchase;
            if (minP > 0) {
                require(totalPurchased >= minP, "Under minimum purchase limit");
            }
            if (maxP > 0) {
                require(totalPurchased <= maxP, "Exceeds maximum purchase limit");
            }
            investorPurchases[roundId][msg.sender] = totalPurchased;
        }

        uint256 cost = (tokenAmount * _rounds[roundId].price) / 1e18;
        require(cost > 0, "Cost is too small");

        _rounds[roundId].soldAmount += tokenAmount;

        _processPayment(_rounds[roundId].paymentToken, _rounds[roundId].treasury, cost);

        require(IERC20(_rounds[roundId].shareToken).transfer(msg.sender, tokenAmount), "Share transfer to investor failed");

        emit SharesPurchased(roundId, msg.sender, tokenAmount, cost);
    }

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

        _depositDividend(dividendToken, totalAmount);

        dividendCount++;
        uint256 dividendId = dividendCount;

        _dividends[dividendId] = DividendRound({
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
        _dividends[dividendId].active = active;
        emit DividendRoundStatusUpdated(dividendId, active);
    }

    function claimDividend(uint256 dividendId) external {
        require(dividendId <= dividendCount && dividendId > 0, "Dividend does not exist");
        require(!hasClaimed[dividendId][msg.sender], "Already claimed");

        uint256 userBalance;
        uint256 totalShares;
        uint256 claimAmount;
        address divToken;

        {
            address shareToken = _dividends[dividendId].shareToken;
            uint256 checkpoint = _dividends[dividendId].checkpointBlock;
            
            require(_dividends[dividendId].active, "Dividend not active");
            require(block.timestamp >= _dividends[dividendId].startTime, "Dividend claim period not started");
            require(block.timestamp <= _dividends[dividendId].endTime, "Dividend claim period ended");

            IEquityToken token = IEquityToken(shareToken);
            userBalance = token.getPastBalanceOf(msg.sender, checkpoint);
            require(userBalance > 0, "No shares owned at checkpoint");

            totalShares = token.getPastTotalSupply(checkpoint);
            require(totalShares > 0, "Total shares must be > 0");
        }

        {
            uint256 totalAmt = _dividends[dividendId].totalAmount;
            claimAmount = (userBalance * totalAmt) / totalShares;
            require(claimAmount > 0, "Claim amount is too small");
            divToken = _dividends[dividendId].dividendToken;
        }

        hasClaimed[dividendId][msg.sender] = true;
        _dividends[dividendId].claimedAmount += claimAmount;

        if (divToken == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: claimAmount}("");
            require(success, "BNB claim payout failed");
        } else {
            require(IERC20(divToken).transfer(msg.sender, claimAmount), "ERC20 claim payout failed");
        }

        emit DividendClaimed(dividendId, msg.sender, claimAmount);
    }

    function reclaimLeftoverDividend(uint256 dividendId, address recipient) external onlyOwner {
        require(dividendId <= dividendCount && dividendId > 0, "Dividend does not exist");
        require(recipient != address(0), "Invalid recipient");
        require(block.timestamp > _dividends[dividendId].endTime, "Claim period has not ended yet");

        uint256 leftover = _dividends[dividendId].totalAmount - _dividends[dividendId].claimedAmount;
        require(leftover > 0, "No leftover funds to reclaim");

        _dividends[dividendId].claimedAmount = _dividends[dividendId].totalAmount;
        address divToken = _dividends[dividendId].dividendToken;

        if (divToken == address(0)) {
            (bool success, ) = payable(recipient).call{value: leftover}("");
            require(success, "Reclaim BNB failed");
        } else {
            require(IERC20(divToken).transfer(recipient, leftover), "Reclaim ERC20 failed");
        }
    }

    receive() external payable {}
}
