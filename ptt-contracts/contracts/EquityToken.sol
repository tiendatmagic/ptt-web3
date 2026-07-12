// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract EquityToken is ERC20, Ownable, Pausable {
    struct Checkpoint {
        uint32 fromBlock;
        uint256 value;
    }

    // Checkpoints for each account's balance
    mapping(address => Checkpoint[]) private _balancesCheckpoints;
    // Checkpoints for total supply
    Checkpoint[] private _totalSupplyCheckpoints;

    // Limit the maximum ownership percentage per wallet (e.g. 10 = 10%)
    // 0 means no limit
    uint256 public maxOwnershipPercent;

    // Whitelist and Blacklist status
    mapping(address => bool) public isWhitelisted;
    mapping(address => bool) public isBlacklisted;
    
    // Operator status (wallets authorized to manage whitelist/blacklist directly)
    mapping(address => bool) public isOperator;
    
    // Whitelist active check (if true, only whitelisted wallets can send/receive tokens)
    bool public isWhitelistEnabled = true;

    // Minter permissions for funding round automated minting
    mapping(address => bool) public isMinter;

    event WhitelistedUpdated(address indexed account, bool status);
    event BlacklistedUpdated(address indexed account, bool status);
    event OperatorStatusUpdated(address indexed operator, bool status);
    event MaxOwnershipPercentUpdated(uint256 percent);
    event WhitelistEnabledUpdated(bool status);
    event MinterStatusUpdated(address indexed minter, bool status);

    modifier onlyMinterOrOwner() {
        require(msg.sender == owner() || isMinter[msg.sender], "Not authorized minter or owner");
        _;
    }

    modifier onlyOwnerOrOperator() {
        require(msg.sender == owner() || isOperator[msg.sender], "Not authorized: must be owner or operator");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        // Default initial owner is whitelisted
        isWhitelisted[initialOwner] = true;
    }

    // --- GOVERNANCE (OWNER) FUNCTIONS ---

    function mint(address to, uint256 amount) external onlyMinterOrOwner whenNotPaused {
        _mint(to, amount);
    }

    // Burn remains only accessible by owner (Governance)
    function burn(address from, uint256 amount) external onlyOwner whenNotPaused {
        _burn(from, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setOperator(address operator, bool status) external onlyOwner {
        isOperator[operator] = status;
        emit OperatorStatusUpdated(operator, status);
    }

    function setWhitelisted(address account, bool status) external onlyOwnerOrOperator {
        isWhitelisted[account] = status;
        emit WhitelistedUpdated(account, status);
    }

    function setBlacklisted(address account, bool status) external onlyOwnerOrOperator {
        isBlacklisted[account] = status;
        emit BlacklistedUpdated(account, status);
    }

    function setWhitelistEnabled(bool enabled) external onlyOwner {
        isWhitelistEnabled = enabled;
        emit WhitelistEnabledUpdated(enabled);
    }

    function setMaxOwnershipPercent(uint256 percent) external onlyOwner {
        require(percent <= 100, "Invalid percent");
        maxOwnershipPercent = percent;
        emit MaxOwnershipPercentUpdated(percent);
    }

    function setMinter(address minter, bool status) external onlyOwner {
        isMinter[minter] = status;
        emit MinterStatusUpdated(minter, status);
    }

    // --- CHECKPOINT QUERY FUNCTIONS ---

    function getPastBalanceOf(address account, uint256 blockNumber) external view returns (uint256) {
        require(blockNumber < block.number, "Block number must be in the past");
        return _getPastValue(_balancesCheckpoints[account], blockNumber);
    }

    function getPastTotalSupply(uint256 blockNumber) external view returns (uint256) {
        require(blockNumber < block.number, "Block number must be in the past");
        return _getPastValue(_totalSupplyCheckpoints, blockNumber);
    }

    // --- OVERRIDES FOR CHECKPOINT & COMPLIANCE ---

    // Override ERC20 _update in OpenZeppelin v5 for transfer hooks and checkpoint updates
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        // Skip compliance checks for minting/burning from/to address(0) by Governance or Minters
        if (from != address(0) && to != address(0)) {
            // Check Blacklist
            require(!isBlacklisted[from], "Sender is blacklisted");
            require(!isBlacklisted[to], "Receiver is blacklisted");

            // Check Whitelist
            if (isWhitelistEnabled) {
                require(isWhitelisted[from], "Sender is not whitelisted");
                require(isWhitelisted[to], "Receiver is not whitelisted");
            }

            // Check Maximum Ownership limit for the receiver
            if (maxOwnershipPercent > 0) {
                uint256 newBalance = balanceOf(to) + value;
                uint256 total = totalSupply();
                if (total > 0) {
                    require(
                        (newBalance * 100) / total <= maxOwnershipPercent,
                        "Exceeds maximum ownership percentage limit"
                    );
                }
            }
        }

        super._update(from, to, value);

        // Update checkpoints
        if (from != address(0)) {
            _updateCheckpoint(_balancesCheckpoints[from], balanceOf(from));
        }
        if (to != address(0)) {
            _updateCheckpoint(_balancesCheckpoints[to], balanceOf(to));
        }
        if (from == address(0) || to == address(0)) {
            _updateCheckpoint(_totalSupplyCheckpoints, totalSupply());
        }
    }

    // --- CHECKPOINT & BINARY SEARCH LOGIC ---

    function _updateCheckpoint(Checkpoint[] storage ckpts, uint256 newValue) private {
        uint32 blockNumber = uint32(block.number);
        uint256 len = ckpts.length;
        if (len > 0 && ckpts[len - 1].fromBlock == blockNumber) {
            ckpts[len - 1].value = newValue;
        } else {
            ckpts.push(Checkpoint({fromBlock: blockNumber, value: newValue}));
        }
    }

    function _getPastValue(Checkpoint[] storage ckpts, uint256 blockNumber) private view returns (uint256) {
        uint256 len = ckpts.length;
        if (len == 0) return 0;
        if (ckpts[0].fromBlock > blockNumber) return 0;
        if (ckpts[len - 1].fromBlock <= blockNumber) return ckpts[len - 1].value;

        uint256 low = 0;
        uint256 high = len - 1;
        while (high > low) {
            uint256 mid = low + (high - low + 1) / 2;
            if (ckpts[mid].fromBlock <= blockNumber) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return ckpts[low].value;
    }
}
