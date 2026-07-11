// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IEquityTokenWithCheckpoint {
    function getPastBalanceOf(address account, uint256 blockNumber) external view returns (uint256);
    function getPastTotalSupply(uint256 blockNumber) external view returns (uint256);
    function isWhitelisted(address account) external view returns (bool);
}

contract DistributionManager is Ownable {
    enum Status { Draft, Approved, Waiting, Active, Finished, Cancelled }

    struct Distribution {
        uint256 id;
        address shareToken;
        address rewardToken; // stablecoin or address(0) for BNB
        uint256 snapshotBlock; // block number for the snapshot
        uint256 totalAmount; // total reward amount
        uint256 claimedAmount; // claimed amount
        uint256 paymentDate; // timestamp to start claiming
        Status status;
    }

    uint256 public distributionCount;
    mapping(uint256 => Distribution) public distributions;
    
    // distributionId => user => hasClaimed
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event DistributionCreated(uint256 indexed id, address indexed rewardToken, uint256 totalAmount);
    event DistributionStatusUpdated(uint256 indexed id, Status status);
    event DividendClaimed(uint256 indexed id, address indexed shareholder, uint256 amount);
    event FundsRefunded(uint256 indexed id, address indexed rewardToken, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // Receive BNB directly to fund dividends
    receive() external payable {}

    // --- DIVIDEND DISTRIBUTION CONFIGURATION (GOVERNANCE) ---

    function createDistribution(
        address shareToken,
        address rewardToken,
        uint256 snapshotBlock,
        uint256 totalAmount,
        uint256 paymentDate
    ) external onlyOwner returns (uint256) {
        require(shareToken != address(0), "Invalid share token");
        require(snapshotBlock < block.number, "Snapshot block must be in the past");
        require(totalAmount > 0, "Amount must be greater than 0");

        distributionCount++;
        uint256 distId = distributionCount;

        distributions[distId] = Distribution({
            id: distId,
            shareToken: shareToken,
            rewardToken: rewardToken,
            snapshotBlock: snapshotBlock,
            totalAmount: totalAmount,
            claimedAmount: 0,
            paymentDate: paymentDate,
            status: Status.Draft
        });

        emit DistributionCreated(distId, rewardToken, totalAmount);
        return distId;
    }

    function approveDistribution(uint256 distId) external onlyOwner {
        Distribution storage dist = distributions[distId];
        require(dist.status == Status.Draft, "Not in Draft status");
        dist.status = Status.Approved;
        emit DistributionStatusUpdated(distId, Status.Approved);
    }

    // Activate dividend distribution (requires funding the contract beforehand)
    function activateDistribution(uint256 distId) external payable onlyOwner {
        Distribution storage dist = distributions[distId];
        require(dist.status == Status.Approved, "Not approved yet");
        
        if (dist.rewardToken == address(0)) {
            // Need enough BNB in contract balance
            require(address(this).balance >= dist.totalAmount, "Insufficient BNB balance in contract");
        } else {
            // Requires transferring stablecoin ERC20 from sender (or Treasury via approval)
            IERC20 token = IERC20(dist.rewardToken);
            require(
                token.balanceOf(address(this)) >= dist.totalAmount, 
                "Insufficient reward token balance in contract"
            );
        }

        dist.status = Status.Active;
        emit DistributionStatusUpdated(distId, Status.Active);
    }

    function cancelDistribution(uint256 distId, address refundTo) external onlyOwner {
        Distribution storage dist = distributions[distId];
        require(dist.status != Status.Finished, "Already finished");
        require(dist.status != Status.Cancelled, "Already cancelled");
        require(dist.claimedAmount == 0, "Cannot cancel if claims have started");

        dist.status = Status.Cancelled;
        emit DistributionStatusUpdated(distId, Status.Cancelled);

        // Refund funds
        if (dist.rewardToken == address(0)) {
            payable(refundTo).transfer(dist.totalAmount);
            emit FundsRefunded(distId, address(0), dist.totalAmount);
        } else {
            IERC20(dist.rewardToken).transfer(refundTo, dist.totalAmount);
            emit FundsRefunded(distId, dist.rewardToken, dist.totalAmount);
        }
    }

    // --- INVESTOR PULL CLAIM FOR DIVIDENDS ---

    function claimDividend(uint256 distId) external {
        Distribution storage dist = distributions[distId];
        require(dist.status == Status.Active, "Distribution not active");
        require(block.timestamp >= dist.paymentDate, "Payment date not reached yet");
        require(!hasClaimed[distId][msg.sender], "Already claimed");

        // Get shareholder balance and total supply at snapshot block
        IEquityTokenWithCheckpoint token = IEquityTokenWithCheckpoint(dist.shareToken);
        uint256 shareholderBalance = token.getPastBalanceOf(msg.sender, dist.snapshotBlock);
        require(shareholderBalance > 0, "No share balance at snapshot block");

        uint256 totalSupply = token.getPastTotalSupply(dist.snapshotBlock);
        require(totalSupply > 0, "Invalid total supply");

        // Calculate reward amount: (shareholderBalance * totalAmount) / totalSupply
        uint256 rewardAmount = (shareholderBalance * dist.totalAmount) / totalSupply;
        require(rewardAmount > 0, "Reward amount too small");

        hasClaimed[distId][msg.sender] = true;
        dist.claimedAmount += rewardAmount;

        // Transfer rewards to user
        if (dist.rewardToken == address(0)) {
            require(address(this).balance >= rewardAmount, "Contract balance leak/error");
            payable(msg.sender).transfer(rewardAmount);
        } else {
            IERC20 rToken = IERC20(dist.rewardToken);
            require(rToken.balanceOf(address(this)) >= rewardAmount, "Insufficient token in contract");
            bool success = rToken.transfer(msg.sender, rewardAmount);
            require(success, "Token reward transfer failed");
        }

        emit DividendClaimed(distId, msg.sender, rewardAmount);

        // If fully claimed (or remaining balance is negligible due to rounding errors)
        if (dist.claimedAmount >= dist.totalAmount) {
            dist.status = Status.Finished;
            emit DistributionStatusUpdated(distId, Status.Finished);
        }
    }
}
