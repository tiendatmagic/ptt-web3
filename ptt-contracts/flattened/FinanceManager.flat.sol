// Sources flattened with hardhat v2.28.6 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/Context.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/token/ERC20/IERC20.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.4.0) (token/ERC20/IERC20.sol)

pragma solidity >=0.4.16;

/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}


// File contracts/FinanceManager.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.34;


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
