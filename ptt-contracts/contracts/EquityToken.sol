// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IBoardGovernance {
    function isMember(address member) external view returns (bool);
}

contract EquityToken is ERC20, Ownable, Pausable {
    struct Checkpoint {
        uint32 fromBlock;
        uint256 value;
    }

    mapping(address => Checkpoint[]) private _balancesCheckpoints;
    Checkpoint[] private _totalSupplyCheckpoints;

    uint256 public maxOwnershipPercent;

    mapping(address => bool) public isWhitelisted;
    mapping(address => bool) public isBlacklisted;
    
    mapping(address => bool) public isOperator;
    
    bool public isWhitelistEnabled = true;

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
        bool isBoardMember = false;
        address currentOwner = owner();
        if (currentOwner != address(0)) {
            try IBoardGovernance(currentOwner).isMember(msg.sender) returns (bool memberStatus) {
                isBoardMember = memberStatus;
            } catch {
                // If owner is not a governance contract or doesn't have isMember, ignore
            }
        }
        require(msg.sender == currentOwner || isOperator[msg.sender] || isBoardMember, "Not authorized: must be owner, operator or board member");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        isWhitelisted[initialOwner] = true;
    }

    function mint(address to, uint256 amount) external onlyMinterOrOwner whenNotPaused {
        _mint(to, amount);
    }

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

    function setWhitelistedBatch(address[] calldata accounts, bool status) external onlyOwnerOrOperator {
        for (uint256 i = 0; i < accounts.length; i++) {
            isWhitelisted[accounts[i]] = status;
            emit WhitelistedUpdated(accounts[i], status);
        }
    }

    function setBlacklistedBatch(address[] calldata accounts, bool status) external onlyOwnerOrOperator {
        for (uint256 i = 0; i < accounts.length; i++) {
            isBlacklisted[accounts[i]] = status;
            emit BlacklistedUpdated(accounts[i], status);
        }
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

    function getPastBalanceOf(address account, uint256 blockNumber) external view returns (uint256) {
        require(blockNumber < block.number, "Block number must be in the past");
        return _getPastValue(_balancesCheckpoints[account], blockNumber);
    }

    function getPastTotalSupply(uint256 blockNumber) external view returns (uint256) {
        require(blockNumber < block.number, "Block number must be in the past");
        return _getPastValue(_totalSupplyCheckpoints, blockNumber);
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        if (from != address(0) && to != address(0)) {
            require(!isBlacklisted[from], "Sender is blacklisted");
            require(!isBlacklisted[to], "Receiver is blacklisted");

            if (isWhitelistEnabled) {
                require(isWhitelisted[from], "Sender is not whitelisted");
            }

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
