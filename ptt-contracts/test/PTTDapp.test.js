const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PTT Dapp Suite", function () {
  let deployer;
  let memberA;
  let memberB;
  let memberC;
  let investorA;
  let investorB;
  
  let registry;
  
  let governance;
  let token;
  let treasury;
  let fundingManager;
  let distributionManager;
  let marketplace;
  let oracle;

  const companyCode = "PTT";
  const companyName = "PTT Group";
  const tokenName = "PTT Share Token";
  const tokenSymbol = "PTTS";

  before(async function () {
    [deployer, memberA, memberB, memberC, investorA, investorB] = await ethers.getSigners();

    // 1. Deploy CompanyRegistry
    const CompanyRegistry = await ethers.getContractFactory("CompanyRegistry");
    registry = await CompanyRegistry.deploy();
    await registry.waitForDeployment();
  });

  it("Should deploy and register a company and link all contracts", async function () {
    const initialBoard = [memberA.address, memberB.address, memberC.address];
    const threshold = 2; // 2/3 signatures

    // 1. Deploy BoardGovernance (acts as Board representative and Owner of the entire system)
    const BoardGovernance = await ethers.getContractFactory("BoardGovernance");
    governance = await BoardGovernance.deploy(initialBoard, threshold);
    await governance.waitForDeployment();
    const govAddr = await governance.getAddress();

    // 2. Deploy EquityToken with Owner set to BoardGovernance
    const EquityToken = await ethers.getContractFactory("EquityToken");
    token = await EquityToken.deploy(tokenName, tokenSymbol, govAddr);
    await token.waitForDeployment();
    const tokenAddr = await token.getAddress();

    // 3. Deploy Treasury with Owner set to BoardGovernance
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(govAddr);
    await treasury.waitForDeployment();
    const treasuryAddr = await treasury.getAddress();

    // 4. Deploy FundingManager with Owner set to BoardGovernance
    const FundingManager = await ethers.getContractFactory("FundingManager");
    fundingManager = await FundingManager.deploy(govAddr);
    await fundingManager.waitForDeployment();
    const fundingAddr = await fundingManager.getAddress();

    // 5. Deploy DistributionManager with Owner set to BoardGovernance
    const DistributionManager = await ethers.getContractFactory("DistributionManager");
    distributionManager = await DistributionManager.deploy(govAddr);
    await distributionManager.waitForDeployment();
    const distAddr = await distributionManager.getAddress();

    // 6. Deploy Marketplace with Owner set to BoardGovernance, fee wallet set to Treasury
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(govAddr, treasuryAddr);
    await marketplace.waitForDeployment();
    const marketAddr = await marketplace.getAddress();

    // 7. Deploy Oracle with Owner set to BoardGovernance
    const Oracle = await ethers.getContractFactory("Oracle");
    oracle = await Oracle.deploy(govAddr);
    await oracle.waitForDeployment();
    const oracleAddr = await oracle.getAddress();

    // 8. Register company details in CompanyRegistry
    await registry.registerCompany(
      companyCode,
      companyName,
      govAddr,
      tokenAddr,
      treasuryAddr,
      fundingAddr,
      distAddr,
      marketAddr,
      oracleAddr
    );

    // Read details from registry
    const company = await registry.getCompanyByCode(companyCode);
    expect(company.registered).to.equal(true);
    expect(company.name).to.equal(companyName);

    expect(await governance.threshold()).to.equal(2n);
    expect(await token.owner()).to.equal(govAddr);
    expect(await treasury.owner()).to.equal(govAddr);
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

  it("Should run a funding round and allow investor to purchase shares", async function () {
    const govAddress = await governance.getAddress();
    
    // Set FundingManager as minter on token
    const setMinterData = token.interface.encodeFunctionData("setMinter", [await fundingManager.getAddress(), true]);
    let propTx = await governance.connect(memberA).createProposal(
      await token.getAddress(),
      0,
      setMinterData,
      "Authorize FundingManager in Token as Minter",
      0,
      3600
    );
    await propTx.wait();
    let propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    await governance.executeProposal(propId);

    // Create a funding round (paying in Native BNB)
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - 60; // started 1 min ago
    const endTime = now + 3600; // ends in 1 hour
    const price = ethers.parseEther("0.1"); // 1 PTTS = 0.1 BNB
    const maxSupply = ethers.parseEther("500"); // sell 500 PTTS max

    const createRoundData = fundingManager.interface.encodeFunctionData("createFundingRound", [
      "Seed Round",
      await token.getAddress(),
      ethers.ZeroAddress, // BNB
      await treasury.getAddress(),
      price,
      maxSupply,
      startTime,
      endTime,
      0,
      0,
      false // public
    ]);

    propTx = await governance.connect(memberA).createProposal(
      await fundingManager.getAddress(),
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

    const roundId = await fundingManager.roundCount();
    
    // Investor A buys 100 PTTS. Cost = 100 * 0.1 BNB = 10 BNB
    const buyAmount = ethers.parseEther("100");
    const cost = ethers.parseEther("10");

    await fundingManager.connect(investorA).buyShares(roundId, buyAmount, { value: cost });

    expect(await token.balanceOf(investorA.address)).to.equal(buyAmount);
    expect(await ethers.provider.getBalance(await treasury.getAddress())).to.equal(cost);
  });

  it("Should distribute dividends using Pull Claim model", async function () {
    const govAddress = await governance.getAddress();
    
    const currentBlock = await ethers.provider.getBlockNumber();
    const snapshotBlock = currentBlock;
    const totalDividendAmount = ethers.parseEther("2"); // 2 BNB
    const now = Math.floor(Date.now() / 1000);

    // Create distribution on DistributionManager
    const createDistData = distributionManager.interface.encodeFunctionData("createDistribution", [
      await token.getAddress(),
      ethers.ZeroAddress, // BNB
      snapshotBlock,
      totalDividendAmount,
      now - 10 // payment date is in the past
    ]);

    let propTx = await governance.connect(memberA).createProposal(
      await distributionManager.getAddress(),
      0,
      createDistData,
      "Create Dividend Distribution",
      0,
      3600
    );
    await propTx.wait();
    let propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    await governance.executeProposal(propId);

    const distId = await distributionManager.distributionCount();

    // Approve distribution on Governance
    const approveDistData = distributionManager.interface.encodeFunctionData("approveDistribution", [distId]);
    propTx = await governance.connect(memberA).createProposal(
      await distributionManager.getAddress(),
      0,
      approveDistData,
      "Approve Dividend Distribution",
      0,
      3600
    );
    await propTx.wait();
    propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    await governance.executeProposal(propId);

    // Activate distribution (Requires funding the contract with 2 BNB)
    const activateDistData = distributionManager.interface.encodeFunctionData("activateDistribution", [distId]);
    propTx = await governance.connect(memberA).createProposal(
      await distributionManager.getAddress(),
      totalDividendAmount, // 2 BNB
      activateDistData,
      "Activate and Fund Dividend",
      0,
      3600
    );
    await propTx.wait();
    propId = await governance.proposalCount();
    await governance.connect(memberB).signProposal(propId);
    
    // Member B/C funded the governance to pay.
    await memberA.sendTransaction({
      to: govAddress,
      value: totalDividendAmount
    });
    
    await governance.executeProposal(propId);

    // Investor A claims dividend
    const beforeBalance = await ethers.provider.getBalance(investorA.address);
    const claimTx = await distributionManager.connect(investorA).claimDividend(distId);
    const receipt = await claimTx.wait();
    const gasPaid = receipt.gasUsed * receipt.gasPrice;

    const afterBalance = await ethers.provider.getBalance(investorA.address);
    expect(afterBalance + gasPaid - beforeBalance).to.equal(totalDividendAmount);
  });
});
