// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Oracle is Ownable {
    uint256 public referencePrice;
    uint256 public lastUpdated;
    string public source;

    mapping(address => bool) public isOperator;

    event PriceUpdated(uint256 newPrice, uint256 timestamp, string source);
    event OperatorStatusUpdated(address indexed operator, bool status);

    modifier onlyOperator() {
        require(isOperator[msg.sender] || msg.sender == owner(), "Not authorized operator");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        isOperator[initialOwner] = true;
    }

    function setOperator(address operator, bool status) external onlyOwner {
        isOperator[operator] = status;
        emit OperatorStatusUpdated(operator, status);
    }

    function updatePrice(uint256 _price, string calldata _source) external onlyOperator {
        require(_price > 0, "Price must be greater than 0");
        referencePrice = _price;
        lastUpdated = block.timestamp;
        source = _source;
        emit PriceUpdated(_price, block.timestamp, _source);
    }
}
