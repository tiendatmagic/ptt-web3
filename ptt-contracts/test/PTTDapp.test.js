const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PTT Dapp Suite", function () {
  let deployer;
  let memberA;
  let memberB;
  let memberC;
  let investorA;
  let investorB;
  
  let governance;
  let token;
  let financeManager;
  let marketplace;
  let buyBlock;

  const companyCode = "PTT";
  const companyName = "PTT Group";
  const tokenName = "PTT Share Token";
  const tokenSymbol = "PTTS";

  before(async function () {
    [deployer, memberA, memberB, memberC, investorA, investorB] = await ethers.getSigners();
  });

  it("Should deploy and link all contracts", async function () {
    const initialBoard = [memberA.address, memberB.address, memberC.address];
    const threshold = 2; // 2/3 signatures

    // 1. Deploy BoardGovernance (acts as Board representative and Owner/Treasury)
    const BoardGovernance = await ethers.getContractFactory("BoardGovernance");
    governance = await BoardGovernance.deploy(initialBoard, threshold);
    await governance.waitForDeployment();
    const govAddr = await governance.getAddress();

    // 2. Deploy EquityToken with Owner set to BoardGovernance
    const EquityToken = await ethers.getContractFactory("EquityToken");
    token = await EquityToken.deploy(tokenName, tokenSymbol, govAddr);
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();

    // 3. Deploy FinanceManager with Owner set to BoardGovernance
    const FinanceManager = await ethers.getContractFactory("FinanceManager");
    financeManager = await FinanceManager.deploy(govAddr);
    await financeManager.waitForDeployment();
    const financeAddr = await financeManager.getAddress();

    // 4. Deploy Marketplace with Owner set to BoardGovernance, fee wallet set to BoardGovernance (Treasury)
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(govAddr, govAddr);
    await marketplace.waitForDeployment();
    const marketAddr = await marketplace.getAddress();

    expect(await governance.threshold()).to.equal(2n);
    expect(await token.owner()).to.equal(govAddr);
    expect(await financeManager.owner()).to.equal(govAddr);
    expect(await marketplace.owner()).to.equal(govAddr);
  });

  it("Should execute a Proposal to whitelist investorA and investorB", async function () {
    // Whitelist investorA
    let whitelistData = token.interface.encodeFunctionData("setWhitelisted", [investorA.address, true]);
    let propTx = await governance.connect(memberA).createProposal(
      await token.getAddress(),
      0,
      whitelistData,
      "Whitelist Investor A",
      0,
      3600
    );
    await propTx.wait();
    let propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    await governance.executeProposal(propId);

    // Whitelist investorB
    whitelistData = token.interface.encodeFunctionData("setWhitelisted", [investorB.address, true]);
    propTx = await governance.connect(memberA).createProposal(
      await token.getAddress(),
      0,
      whitelistData,
      "Whitelist Investor B",
      0,
      3600
    );
    await propTx.wait();
    propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    await governance.executeProposal(propId);

    expect(await token.isWhitelisted(investorA.address)).to.equal(true);
    expect(await token.isWhitelisted(investorB.address)).to.equal(true);
  });

  it("Should run a funding round and allow investor to purchase shares using pre-minted tokens", async function () {
    const govAddress = await governance.getAddress();
    const financeAddress = await financeManager.getAddress();
    const tokenAddress = await token.getAddress();

    // 1. Whitelist FinanceManager in EquityToken compliance whitelist
    const whitelistFinanceData = token.interface.encodeFunctionData("setWhitelisted", [financeAddress, true]);
    let propTx = await governance.connect(memberA).createProposal(
      tokenAddress,
      0,
      whitelistFinanceData,
      "Whitelist FinanceManager",
      0,
      3600
    );
    await propTx.wait();
    let propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    await governance.executeProposal(propId);

    // 2. Mint 500 shares to FinanceManager (via BoardGovernance Multisig)
    const mintAmount = ethers.parseEther("500");
    const mintData = token.interface.encodeFunctionData("mint", [financeAddress, mintAmount]);
    propTx = await governance.connect(memberA).createProposal(
      tokenAddress,
      0,
      mintData,
      "Mint 500 PTT to FinanceManager",
      0,
      3600
    );
    await propTx.wait();
    propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    await governance.executeProposal(propId);

    // Confirm FinanceManager received PTT
    expect(await token.balanceOf(financeAddress)).to.equal(mintAmount);

    // 2. Create a funding round (paying in Native BNB)
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - 60; // started 1 min ago
    const endTime = now + 3600; // ends in 1 hour
    const price = ethers.parseEther("0.1"); // 1 PTTS = 0.1 BNB
    const maxSupply = ethers.parseEther("500"); // sell 500 PTTS max

    const createRoundData = financeManager.interface.encodeFunctionData("createFundingRound", [
      "Seed Round",
      tokenAddress,
      ethers.ZeroAddress, // BNB payment
      govAddress, // treasury = BoardGovernance
      price,
      maxSupply,
      startTime,
      endTime,
      0,
      0,
      false // public
    ]);

    propTx = await governance.connect(memberA).createProposal(
      financeAddress,
      0,
      createRoundData,
      "Create Seed Round",
      0,
      3600
    );
    await propTx.wait();
    propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    await governance.executeProposal(propId);

    const roundId = await financeManager.roundCount();
    
    // Investor A buys 100 PTTS. Cost = 100 * 0.1 BNB = 10 BNB
    const buyAmount = ethers.parseEther("100");
    const cost = ethers.parseEther("10");

    const buyTx = await financeManager.connect(investorA).buyShares(roundId, buyAmount, { value: cost });
    const buyReceipt = await buyTx.wait();
    buyBlock = buyReceipt.blockNumber;

    // Mine a block to ensure checkpoint is finalized in the past
    await ethers.provider.send("evm_mine", []);

    expect(await token.balanceOf(investorA.address)).to.equal(buyAmount);
    expect(await ethers.provider.getBalance(govAddress)).to.equal(cost);
  });

  it("Should distribute dividends using Pull Claim model in FinanceManager", async function () {
    const govAddress = await governance.getAddress();
    const financeAddress = await financeManager.getAddress();
    const tokenAddress = await token.getAddress();
    
    const snapshotBlock = buyBlock; // block where Investor A held 100 shares
    const totalDividendAmount = ethers.parseEther("2"); // 2 BNB dividend
    const now = Math.floor(Date.now() / 1000);

    // Create and fund dividend on FinanceManager
    const createDistData = financeManager.interface.encodeFunctionData("createDividendRound", [
      "Q1 Dividend",
      tokenAddress,
      ethers.ZeroAddress, // BNB
      totalDividendAmount,
      snapshotBlock,
      now - 10,
      now + 3600
    ]);

    // Member B/C funded the governance to pay.
    await memberA.sendTransaction({
      to: govAddress,
      value: totalDividendAmount
    });

    let propTx = await governance.connect(memberA).createProposal(
      financeAddress,
      totalDividendAmount, // send 2 BNB value to financeManager
      createDistData,
      "Create and Fund Q1 Dividend Distribution",
      0,
      3600
    );
    await propTx.wait();
    let propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    await governance.executeProposal(propId);

    const divId = await financeManager.dividendCount();

    // Investor A claims dividend (Investor A owns 20% of the total shares: 100 / 500)
    const beforeBalance = await ethers.provider.getBalance(investorA.address);
    const claimTx = await financeManager.connect(investorA).claimDividend(divId);
    const receipt = await claimTx.wait();
    const gasPaid = receipt.gasUsed * receipt.gasPrice;

    const afterBalance = await ethers.provider.getBalance(investorA.address);
    const expectedClaim = (totalDividendAmount * 100n) / 500n; // 20% of 2 BNB = 0.4 BNB
    expect(afterBalance + gasPaid - beforeBalance).to.equal(expectedClaim);
  });

  it("Should allow HĐQT to assign an Operator who can whitelist/blacklist directly without multisig", async function () {
    const govAddress = await governance.getAddress();
    const tokenAddress = await token.getAddress();

    // 1. Assign memberA as an Operator via Board Governance (requires proposal since Board is Owner)
    const setOperatorData = token.interface.encodeFunctionData("setOperator", [memberA.address, true]);
    let propTx = await governance.connect(memberA).createProposal(
      tokenAddress,
      0,
      setOperatorData,
      "Set memberA as Operator",
      0,
      3600
    );
    await propTx.wait();
    let propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    await governance.executeProposal(propId);

    // Verify memberA is now an operator
    expect(await token.isOperator(memberA.address)).to.equal(true);

    // 2. memberA (Operator) whitelists investorB directly (without proposal/multisig)
    // Let's set to false first using memberA
    await token.connect(memberA).setWhitelisted(investorB.address, false);
    expect(await token.isWhitelisted(investorB.address)).to.equal(false);

    // Now whitelist again
    await token.connect(memberA).setWhitelisted(investorB.address, true);
    expect(await token.isWhitelisted(investorB.address)).to.equal(true);

    // 3. A non-operator, non-owner wallet (like investorA) trying to setWhitelisted should fail
    await expect(
      token.connect(investorA).setWhitelisted(investorB.address, false)
    ).to.be.revertedWith("Not authorized: must be owner or operator");
  });

  it("Should allow HĐQT to assign an Operator in FinanceManager who can update round price directly", async function () {
    const govAddress = await governance.getAddress();
    const financeAddress = await financeManager.getAddress();

    // 1. Assign memberA as an Operator of FinanceManager via Board Governance proposal
    const setOperatorData = financeManager.interface.encodeFunctionData("setOperator", [memberA.address]);
    let propTx = await governance.connect(memberA).createProposal(
      financeAddress,
      0,
      setOperatorData,
      "Set memberA as Operator of FinanceManager",
      0,
      3600
    );
    await propTx.wait();
    let propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    await governance.executeProposal(propId);

    // Verify memberA is now the operator
    expect(await financeManager.operator()).to.equal(memberA.address);

    // 2. memberA (Operator) updates round price directly
    const roundId = 1;
    const newPrice = ethers.parseEther("0.02"); // change to 0.02 BNB/Token
    
    await financeManager.connect(memberA).updateRoundPrice(roundId, newPrice);
    const round = await financeManager.rounds(roundId);
    expect(round.price).to.equal(newPrice);

    // 3. A non-operator trying to update price should fail
    await expect(
      financeManager.connect(investorA).updateRoundPrice(roundId, ethers.parseEther("0.03"))
    ).to.be.revertedWith("Not owner or operator");
  });
});
