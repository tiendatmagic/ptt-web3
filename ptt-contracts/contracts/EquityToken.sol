
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IBoardGovernance {
    function isMember(address member) external view returns (bool);
}

contract EquityToken is ERC20, Ownable, Pausable, IERC721Receiver, IERC1155Receiver {
    struct Checkpoint {
        uint32 fromBlock;
        uint256 value;
    }

    mapping(address => Checkpoint[]) private _balancesCheckpoints;
    Checkpoint[] private _totalSupplyCheckpoints;

    uint256 public maxOwnershipPercent;

    mapping(address => bool) public isWhitelisted;
    mapping(address => bool) public isBlacklisted;

    address[] public whitelistAddresses;
    address[] public blacklistAddresses;

    mapping(address => uint256) private _whitelistAddressIndex;
    mapping(address => uint256) private _blacklistAddressIndex;

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
        if (currentOwner != address(0) && currentOwner.code.length > 0) {
            try IBoardGovernance(currentOwner).isMember(msg.sender) returns (bool memberStatus) {
                isBoardMember = memberStatus;
            } catch {

            }
        }
        require(msg.sender == currentOwner || isOperator[msg.sender] || isBoardMember, "Not authorized: must be owner, operator or board member");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address initialOwner,
        address[] memory initialWhitelist,
        address[] memory initialMinters
    ) ERC20(name, symbol) Ownable(initialOwner) {
        _addWhitelist(initialOwner);
        for (uint256 i = 0; i < initialWhitelist.length; i++) {
            _addWhitelist(initialWhitelist[i]);
        }
        for (uint256 i = 0; i < initialMinters.length; i++) {
            isMinter[initialMinters[i]] = true;
            emit MinterStatusUpdated(initialMinters[i], true);
        }
    }

    function mint(address to, uint256 amount) external onlyMinterOrOwner whenNotPaused {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner whenNotPaused {
        _burn(from, amount);
    }

    function burnFrom(address from, uint256 amount) external onlyMinterOrOwner whenNotPaused {
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

    function _addWhitelist(address account) private {
        if (!isWhitelisted[account]) {
            isWhitelisted[account] = true;
            _whitelistAddressIndex[account] = whitelistAddresses.length;
            whitelistAddresses.push(account);
            emit WhitelistedUpdated(account, true);
        }
    }

    function _removeWhitelist(address account) private {
        if (isWhitelisted[account]) {
            isWhitelisted[account] = false;
            uint256 indexToDelete = _whitelistAddressIndex[account];
            uint256 lastIndex = whitelistAddresses.length - 1;
            address lastAddress = whitelistAddresses[lastIndex];

            whitelistAddresses[indexToDelete] = lastAddress;
            _whitelistAddressIndex[lastAddress] = indexToDelete;

            whitelistAddresses.pop();
            delete _whitelistAddressIndex[account];
            emit WhitelistedUpdated(account, false);
        }
    }

    function _addBlacklist(address account) private {
        if (!isBlacklisted[account]) {
            isBlacklisted[account] = true;
            _blacklistAddressIndex[account] = blacklistAddresses.length;
            blacklistAddresses.push(account);
            emit BlacklistedUpdated(account, true);
        }
    }

    function _removeBlacklist(address account) private {
        if (isBlacklisted[account]) {
            isBlacklisted[account] = false;
            uint256 indexToDelete = _blacklistAddressIndex[account];
            uint256 lastIndex = blacklistAddresses.length - 1;
            address lastAddress = blacklistAddresses[lastIndex];

            blacklistAddresses[indexToDelete] = lastAddress;
            _blacklistAddressIndex[lastAddress] = indexToDelete;

            blacklistAddresses.pop();
            delete _blacklistAddressIndex[account];
            emit BlacklistedUpdated(account, false);
        }
    }

    function setWhitelisted(address account, bool status) external onlyOwnerOrOperator {
        if (status) {
            _addWhitelist(account);
        } else {
            _removeWhitelist(account);
        }
    }

    function setBlacklisted(address account, bool status) external onlyOwnerOrOperator {
        if (status) {
            _addBlacklist(account);
        } else {
            _removeBlacklist(account);
        }
    }

    function setWhitelistedBatch(address[] calldata accounts, bool status) external onlyOwnerOrOperator {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (status) {
                _addWhitelist(accounts[i]);
            } else {
                _removeWhitelist(accounts[i]);
            }
        }
    }

    function setBlacklistedBatch(address[] calldata accounts, bool status) external onlyOwnerOrOperator {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (status) {
                _addBlacklist(accounts[i]);
            } else {
                _removeBlacklist(accounts[i]);
            }
        }
    }

    function getWhitelistedAddresses(uint256 offset, uint256 limit) external view returns (address[] memory result, uint256 total) {
        uint256 totalAddresses = whitelistAddresses.length;
        if (offset >= totalAddresses) {
            return (new address[](0), totalAddresses);
        }

        uint256 size = limit;
        if (offset + limit > totalAddresses) {
            size = totalAddresses - offset;
        }

        result = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = whitelistAddresses[offset + i];
        }

        return (result, totalAddresses);
    }

    function getBlacklistedAddresses(uint256 offset, uint256 limit) external view returns (address[] memory result, uint256 total) {
        uint256 totalAddresses = blacklistAddresses.length;
        if (offset >= totalAddresses) {
            return (new address[](0), totalAddresses);
        }

        uint256 size = limit;
        if (offset + limit > totalAddresses) {
            size = totalAddresses - offset;
        }

        result = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = blacklistAddresses[offset + i];
        }

        return (result, totalAddresses);
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
                require(isWhitelisted[from] || from == address(this), "Sender is not whitelisted");
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

    function rescueNative(address payable recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function rescueERC20(address token, address recipient, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(recipient != address(0), "Invalid recipient");
        require(IERC20(token).transfer(recipient, amount), "Transfer failed");
    }

    function rescueERC721(address token, address recipient, uint256 tokenId) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(recipient != address(0), "Invalid recipient");
        IERC721(token).safeTransferFrom(address(this), recipient, tokenId);
    }

    function rescueERC1155(address token, address recipient, uint256 tokenId, uint256 amount, bytes calldata data) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(recipient != address(0), "Invalid recipient");
        IERC1155(token).safeTransferFrom(address(this), recipient, tokenId, amount, data);
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

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }
}
