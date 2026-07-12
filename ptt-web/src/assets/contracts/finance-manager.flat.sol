◇ injected env (0) from ..\.env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
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
pragma solidity ^0.8.24;


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

    address public operator;

    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event RoundPriceUpdated(uint256 indexed roundId, uint256 newPrice);

    modifier onlyOwnerOrOperator() {
        require(msg.sender == owner() || msg.sender == operator, "Not owner or operator");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setOperator(address _operator) external onlyOwner {
        address oldOperator = operator;
        operator = _operator;
        emit OperatorUpdated(oldOperator, _operator);
    }

    function updateRoundPrice(uint256 roundId, uint256 newPrice) external onlyOwnerOrOperator {
        require(roundId <= roundCount && roundId > 0, "Round does not exist");
        require(newPrice > 0, "Invalid price");
        rounds[roundId].price = newPrice;
        emit RoundPriceUpdated(roundId, newPrice);
    }

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
