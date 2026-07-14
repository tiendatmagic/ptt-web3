// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IEquityToken {
    function getPastBalanceOf(
        address account,
        uint256 blockNumber
    ) external view returns (uint256);

    function getPastTotalSupply(
        uint256 blockNumber
    ) external view returns (uint256);

    function isWhitelisted(address account) external view returns (bool);

    // Mint token trực tiếp cho người mua (mint-on-demand)
    function mint(address to, uint256 amount) external;

    // Đốt token của nhà đầu tư khi hoàn tiền
    function burnFrom(address from, uint256 amount) external;
}

contract FinanceManager is Ownable {
    error NotOwnerOrOperator();
    error RoundDoesNotExist();
    error InvalidPrice();
    error InvalidAddresses();
    error InvalidTime();
    error InvalidPricingOrSupply();
    error RoundNotActive();
    error RoundFinishedOrCancelled();
    error RoundNotStarted();
    error RoundEnded();
    error ExceedsMaxSupply();
    error NotWhitelistedInRound();
    error NotWhitelistedForHolding();
    error UnderMinLimit();
    error ExceedsMaxLimit();
    error InsufficientBNB();
    error TransferFailed();
    error ZeroBNBRequired();
    error LowBalance();
    error AlreadyClaimed();
    error DividendNotActive();
    error DividendNotStarted();
    error DividendEnded();
    error NoSharesAtCheckpoint();
    error InsufficientClaimAmount();
    error ReclaimNotAllowed();
    error NoLeftover();

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
        bool finalized;
        bool cancelled;
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
    mapping(uint256 => mapping(address => uint256)) public investorPayments;
    mapping(uint256 => mapping(address => bool)) public roundWhitelist;

    uint256 public dividendCount;
    mapping(uint256 => DividendRound) private _dividends;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event RoundCreated(uint256 indexed roundId, string name, uint256 price);
    event RoundStatusUpdated(uint256 indexed roundId, bool active);
    event SharesPurchased(
        uint256 indexed roundId,
        address indexed investor,
        uint256 amount,
        uint256 cost
    );
    event WhitelistUpdated(
        uint256 indexed roundId,
        address[] accounts,
        bool status
    );

    event DividendRoundCreated(
        uint256 indexed dividendId,
        string name,
        uint256 totalAmount,
        uint256 checkpointBlock
    );
    event DividendClaimed(
        uint256 indexed dividendId,
        address indexed shareholder,
        uint256 amount
    );
    event DividendRoundStatusUpdated(uint256 indexed dividendId, bool active);

    address public operator;

    event OperatorUpdated(
        address indexed previousOperator,
        address indexed newOperator
    );
    event RoundPriceUpdated(uint256 indexed roundId, uint256 newPrice);
    event RoundFinalized(
        uint256 indexed roundId,
        uint256 totalRaised,
        uint256 returnedShares
    );
    event RoundCancelled(uint256 indexed roundId, uint256 returnedShares);
    event RefundClaimed(
        uint256 indexed roundId,
        address indexed investor,
        uint256 shares,
        uint256 amount
    );

    modifier onlyOwnerOrOperator() {
        if (msg.sender != owner() && msg.sender != operator)
            revert NotOwnerOrOperator();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function rounds(
        uint256 roundId
    ) external view returns (FundingRound memory) {
        return _rounds[roundId];
    }

    function dividends(
        uint256 dividendId
    ) external view returns (DividendRound memory) {
        return _dividends[dividendId];
    }

    function setOperator(address _operator) external onlyOwner {
        address oldOperator = operator;
        operator = _operator;
        emit OperatorUpdated(oldOperator, _operator);
    }

    function updateRoundPrice(
        uint256 roundId,
        uint256 newPrice
    ) external onlyOwnerOrOperator {
        if (roundId > roundCount || roundId == 0) revert RoundDoesNotExist();
        if (newPrice == 0) revert InvalidPrice();
        _rounds[roundId].price = newPrice;
        emit RoundPriceUpdated(roundId, newPrice);
    }

    function createFundingRound(
        RoundParams calldata p
    ) external onlyOwner returns (uint256) {
        if (p.shareToken == address(0) || p.treasury == address(0))
            revert InvalidAddresses();
        if (p.endTime <= p.startTime) revert InvalidTime();
        if (p.price == 0 || p.maxSupply == 0) revert InvalidPricingOrSupply();

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
            active: true,
            finalized: false,
            cancelled: false
        });

        emit RoundCreated(roundId, p.name, p.price);
        return roundId;
    }

    function setRoundStatus(uint256 roundId, bool active) external onlyOwner {
        if (roundId > roundCount || roundId == 0) revert RoundDoesNotExist();
        _rounds[roundId].active = active;
        emit RoundStatusUpdated(roundId, active);
    }

    function updateRoundWhitelist(
        uint256 roundId,
        address[] calldata accounts,
        bool status
    ) external onlyOwner {
        if (roundId > roundCount || roundId == 0) revert RoundDoesNotExist();
        for (uint256 i = 0; i < accounts.length; i++) {
            roundWhitelist[roundId][accounts[i]] = status;
        }
        emit WhitelistUpdated(roundId, accounts, status);
    }

    function _processPayment(address paymentToken, uint256 cost) private {
        if (paymentToken == address(0)) {
            if (msg.value < cost) revert InsufficientBNB();
            if (msg.value > cost) {
                (bool refundSuccess, ) = payable(msg.sender).call{
                    value: msg.value - cost
                }("");
                if (!refundSuccess) revert TransferFailed();
            }
        } else {
            if (msg.value != 0) revert ZeroBNBRequired();
            IERC20 token = IERC20(paymentToken);
            if (token.balanceOf(msg.sender) < cost) revert LowBalance();
            if (!token.transferFrom(msg.sender, address(this), cost))
                revert TransferFailed();
        }
    }

    function _depositDividend(
        address dividendToken,
        uint256 totalAmount
    ) private {
        if (dividendToken == address(0)) {
            if (msg.value != totalAmount) revert InsufficientBNB();
        } else {
            if (msg.value != 0) revert ZeroBNBRequired();
            IERC20 token = IERC20(dividendToken);
            if (token.balanceOf(msg.sender) < totalAmount) revert LowBalance();
            if (!token.transferFrom(msg.sender, address(this), totalAmount))
                revert TransferFailed();
        }
    }

    function buyShares(uint256 roundId, uint256 tokenAmount) external payable {
        if (roundId > roundCount || roundId == 0) revert RoundDoesNotExist();

        {
            if (!_rounds[roundId].active) revert RoundNotActive();
            if (_rounds[roundId].finalized || _rounds[roundId].cancelled)
                revert RoundFinishedOrCancelled();
            if (block.timestamp < _rounds[roundId].startTime)
                revert RoundNotStarted();
            if (block.timestamp > _rounds[roundId].endTime) revert RoundEnded();
            if (
                _rounds[roundId].soldAmount + tokenAmount >
                _rounds[roundId].maxSupply
            ) revert ExceedsMaxSupply();
        }

        {
            address shareToken = _rounds[roundId].shareToken;
            if (_rounds[roundId].isWhitelistOnly) {
                if (!roundWhitelist[roundId][msg.sender])
                    revert NotWhitelistedInRound();
            }
            if (!IEquityToken(shareToken).isWhitelisted(msg.sender))
                revert NotWhitelistedForHolding();
        }

        {
            uint256 totalPurchased = investorPurchases[roundId][msg.sender] +
                tokenAmount;
            uint256 minP = _rounds[roundId].minPurchase;
            uint256 maxP = _rounds[roundId].maxPurchase;
            if (minP > 0) {
                if (totalPurchased < minP) revert UnderMinLimit();
            }
            if (maxP > 0) {
                if (totalPurchased > maxP) revert ExceedsMaxLimit();
            }
            investorPurchases[roundId][msg.sender] = totalPurchased;
        }

        uint256 cost = (tokenAmount * _rounds[roundId].price) / 1e18;
        if (cost == 0) revert InvalidPrice();

        _rounds[roundId].soldAmount += tokenAmount;
        investorPayments[roundId][msg.sender] += cost;

        _processPayment(_rounds[roundId].paymentToken, cost);

        // Mint-on-demand: tự mint token cổ phần trực tiếp cho nhà đầu tư
        IEquityToken(_rounds[roundId].shareToken).mint(msg.sender, tokenAmount);

        emit SharesPurchased(roundId, msg.sender, tokenAmount, cost);
    }

    function finalizeFundingRound(uint256 roundId) external onlyOwner {
        if (roundId > roundCount || roundId == 0) revert RoundDoesNotExist();
        FundingRound storage round = _rounds[roundId];
        if (!round.active) revert RoundNotActive();
        if (round.finalized || round.cancelled)
            revert RoundFinishedOrCancelled();

        round.active = false;
        round.finalized = true;

        uint256 cost = (round.soldAmount * round.price) / 1e18;

        if (cost > 0) {
            if (round.paymentToken == address(0)) {
                (bool success, ) = round.treasury.call{value: cost}("");
                if (!success) revert TransferFailed();
            } else {
                IERC20 token = IERC20(round.paymentToken);
                if (!token.transfer(round.treasury, cost))
                    revert TransferFailed();
            }
        }

        // Mint-on-demand: không có pool token tồn đợng, không cần chuyển remaining shares

        emit RoundFinalized(roundId, cost, 0);
    }

    function cancelFundingRound(uint256 roundId) external onlyOwner {
        if (roundId > roundCount || roundId == 0) revert RoundDoesNotExist();
        FundingRound storage round = _rounds[roundId];
        if (!round.active) revert RoundNotActive();
        if (round.finalized || round.cancelled)
            revert RoundFinishedOrCancelled();

        round.active = false;
        round.cancelled = true;

        // Mint-on-demand: không có pool token tồn đợng, không cần chuyển remaining shares

        emit RoundCancelled(roundId, 0);
    }

    function claimRefund(uint256 roundId) external {
        if (roundId > roundCount || roundId == 0) revert RoundDoesNotExist();
        FundingRound storage round = _rounds[roundId];
        if (!round.cancelled) revert RoundFinishedOrCancelled();

        uint256 shares = investorPurchases[roundId][msg.sender];
        uint256 payment = investorPayments[roundId][msg.sender];

        if (shares == 0 || payment == 0) revert LowBalance();

        investorPurchases[roundId][msg.sender] = 0;
        investorPayments[roundId][msg.sender] = 0;

        // Đốt token của nhà đầu tư khi hoàn tiền (mint-on-demand: không chuyển về treasury mà burn luôn)
        IEquityToken(round.shareToken).burnFrom(msg.sender, shares);

        if (round.paymentToken == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: payment}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20 token = IERC20(round.paymentToken);
            if (!token.transfer(msg.sender, payment)) revert TransferFailed();
        }

        emit RefundClaimed(roundId, msg.sender, shares, payment);
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
        if (shareToken == address(0)) revert InvalidAddresses();
        if (totalAmount == 0) revert InvalidPricingOrSupply();
        if (checkpointBlock >= block.number) revert InvalidTime();
        if (endTime <= startTime) revert InvalidTime();

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

        emit DividendRoundCreated(
            dividendId,
            name,
            totalAmount,
            checkpointBlock
        );
        return dividendId;
    }

    function setDividendStatus(
        uint256 dividendId,
        bool active
    ) external onlyOwner {
        if (dividendId > dividendCount || dividendId == 0)
            revert RoundDoesNotExist();
        _dividends[dividendId].active = active;
        emit DividendRoundStatusUpdated(dividendId, active);
    }

    function claimDividend(uint256 dividendId) external {
        if (dividendId > dividendCount || dividendId == 0)
            revert RoundDoesNotExist();
        if (hasClaimed[dividendId][msg.sender]) revert AlreadyClaimed();

        uint256 userBalance;
        uint256 totalShares;
        uint256 claimAmount;
        address divToken;

        {
            address shareToken = _dividends[dividendId].shareToken;
            uint256 checkpoint = _dividends[dividendId].checkpointBlock;

            if (!_dividends[dividendId].active) revert DividendNotActive();
            if (block.timestamp < _dividends[dividendId].startTime)
                revert DividendNotStarted();
            if (block.timestamp > _dividends[dividendId].endTime)
                revert DividendEnded();

            IEquityToken token = IEquityToken(shareToken);
            userBalance = token.getPastBalanceOf(msg.sender, checkpoint);
            if (userBalance == 0) revert NoSharesAtCheckpoint();

            totalShares = token.getPastTotalSupply(checkpoint);
            if (totalShares == 0) revert NoSharesAtCheckpoint();
        }

        {
            uint256 totalAmt = _dividends[dividendId].totalAmount;
            claimAmount = (userBalance * totalAmt) / totalShares;
            if (claimAmount == 0) revert InsufficientClaimAmount();
            divToken = _dividends[dividendId].dividendToken;
        }

        hasClaimed[dividendId][msg.sender] = true;
        _dividends[dividendId].claimedAmount += claimAmount;

        if (divToken == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: claimAmount}("");
            if (!success) revert TransferFailed();
        } else {
            if (!IERC20(divToken).transfer(msg.sender, claimAmount))
                revert TransferFailed();
        }

        emit DividendClaimed(dividendId, msg.sender, claimAmount);
    }

    function reclaimLeftoverDividend(
        uint256 dividendId,
        address recipient
    ) external onlyOwner {
        if (dividendId > dividendCount || dividendId == 0)
            revert RoundDoesNotExist();
        if (recipient == address(0)) revert InvalidAddresses();
        if (block.timestamp <= _dividends[dividendId].endTime)
            revert ReclaimNotAllowed();

        uint256 leftover = _dividends[dividendId].totalAmount -
            _dividends[dividendId].claimedAmount;
        if (leftover == 0) revert NoLeftover();

        _dividends[dividendId].claimedAmount = _dividends[dividendId]
            .totalAmount;
        address divToken = _dividends[dividendId].dividendToken;

        if (divToken == address(0)) {
            (bool success, ) = payable(recipient).call{value: leftover}("");
            if (!success) revert TransferFailed();
        } else {
            if (!IERC20(divToken).transfer(recipient, leftover))
                revert TransferFailed();
        }
    }

    receive() external payable {}
}
