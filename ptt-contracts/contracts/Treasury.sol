// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Treasury is Ownable {
    event Deposit(address indexed token, address indexed from, uint256 amount);
    event Withdraw(address indexed token, address indexed to, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // Receive Native Coin directly (BNB)
    receive() external payable {
        emit Deposit(address(0), msg.sender, msg.value);
    }

    fallback() external payable {
        if (msg.value > 0) {
            emit Deposit(address(0), msg.sender, msg.value);
        }
    }

    // Withdraw funds/stablecoins (Only Owner - BoardGovernance)
    function withdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(to != address(0), "Invalid receiver");
        require(amount > 0, "Amount must be greater than 0");

        if (token == address(0)) {
            // Withdraw Native BNB
            require(address(this).balance >= amount, "Insufficient BNB balance");
            (bool success, ) = to.call{value: amount}("");
            require(success, "BNB transfer failed");
        } else {
            // Withdraw ERC20 (USDT / USDC / etc.)
            IERC20 erc20 = IERC20(token);
            require(erc20.balanceOf(address(this)) >= amount, "Insufficient token balance");
            bool success = erc20.transfer(to, amount);
            require(success, "Token transfer failed");
        }

        emit Withdraw(token, to, amount);
    }

    // Get the current balance of the treasury
    function getBalance(address token) external view returns (uint256) {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }
}
