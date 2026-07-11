const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("====================================================");
  console.log("DEPLOYING SMART CONTRACTS TO BSC TESTNET");
  console.log("Deployer Address:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer BNB Balance:", ethers.formatEther(balance));
  console.log("====================================================");

  // 1. Deploy CompanyRegistry
  console.log("Deploying CompanyRegistry...");
  const CompanyRegistry = await ethers.getContractFactory("CompanyRegistry");
  const registry = await CompanyRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("CompanyRegistry deployed to:", registryAddress);

  // 2. Set deployer as authorized factory temporarily to register companies
  console.log("Configuring registry permissions...");
  const tx = await registry.setFactory(deployer.address, true);
  await tx.wait();
  console.log("Deployer temporarily authorized in CompanyRegistry!");

  // 3. Deploy a demo company (PTT Group)
  console.log("Deploying contracts for PTT Group...");
  const code = "PTT";
  const name = "PTT Group";
  const tokenName = "PTT Share Token";
  const tokenSymbol = "PTTS";
  const initialBoard = [deployer.address];
  const threshold = 1;

  // 3.1. Deploy BoardGovernance
  console.log("Deploying BoardGovernance...");
  const BoardGovernance = await ethers.getContractFactory("BoardGovernance");
  const governance = await BoardGovernance.deploy(initialBoard, threshold);
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  console.log("BoardGovernance deployed to:", govAddr);

  // 3.2. Deploy EquityToken with Owner set to BoardGovernance
  console.log("Deploying EquityToken...");
  const EquityToken = await ethers.getContractFactory("EquityToken");
  const token = await EquityToken.deploy(tokenName, tokenSymbol, govAddr);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("EquityToken deployed to:", tokenAddr);

  // 3.3. Treasury address is set directly to BoardGovernance address
  const treasuryAddr = govAddr;
  console.log("Treasury address mapped to BoardGovernance:", treasuryAddr);

  // 3.4. Deploy FinanceManager with Owner set to BoardGovernance
  console.log("Deploying FinanceManager...");
  const FinanceManager = await ethers.getContractFactory("FinanceManager");
  const financeManager = await FinanceManager.deploy(govAddr);
  await financeManager.waitForDeployment();
  const financeAddr = await financeManager.getAddress();
  const fundingAddr = financeAddr;
  const distAddr = financeAddr;
  console.log("FinanceManager deployed to:", financeAddr);

  // 3.5. Deploy Marketplace with Owner set to BoardGovernance, fee wallet set to Treasury (BoardGovernance)
  console.log("Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(govAddr, treasuryAddr);
  await marketplace.waitForDeployment();
  const marketAddr = await marketplace.getAddress();
  console.log("Marketplace deployed to:", marketAddr);

  // 3.6. Deploy Oracle with Owner set to BoardGovernance
  console.log("Deploying Oracle...");
  const Oracle = await ethers.getContractFactory("Oracle");
  const oracle = await Oracle.deploy(govAddr);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("Oracle deployed to:", oracleAddr);

  // 4. Register company details in CompanyRegistry
  console.log("Registering PTT Group in CompanyRegistry...");
  const regTx = await registry.registerCompany(
    code,
    name,
    govAddr,
    tokenAddr,
    treasuryAddr,
    fundingAddr,
    distAddr,
    marketAddr,
    oracleAddr
  );
  await regTx.wait();
  console.log("PTT Group registered successfully!");

  console.log("====================================================");
  console.log("ALL CONTRACTS DEPLOYED & REGISTERED SUCCESSFULLY!");
  console.log("CompanyRegistry:", registryAddress);
  console.log("Governance (Board Multisig & Treasury):", govAddr);
  console.log("EquityToken (Shares):", tokenAddr);
  console.log("FinanceManager (Funding & Dividend):", financeAddr);
  console.log("Marketplace (Trading):", marketAddr);
  console.log("Oracle (Pricing):", oracleAddr);
  console.log("====================================================");

  // Print verification commands
  console.log("To verify these contracts on BscScan:");
  console.log(`npx hardhat verify --network bscTestnet ${registryAddress}`);
  console.log(`npx hardhat verify --network bscTestnet ${govAddr} "[\\"${initialBoard.join('\\",\\"')}\\"]" ${threshold}`);
  console.log(`npx hardhat verify --network bscTestnet ${tokenAddr} "${tokenName}" "${tokenSymbol}" ${govAddr}`);
  console.log(`npx hardhat verify --network bscTestnet ${financeAddr} ${govAddr}`);
  console.log(`npx hardhat verify --network bscTestnet ${marketAddr} ${govAddr} ${treasuryAddr}`);
  console.log(`npx hardhat verify --network bscTestnet ${oracleAddr} ${govAddr}`);
  console.log("====================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
