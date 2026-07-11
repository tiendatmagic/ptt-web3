const hre = require("hardhat");

async function main() {
  const registry = "0xb7b937410377F054258Bea7F319618C504088aA4";
  const governance = "0x1e9566aA637437783A7975CA83106C11dD6ceB43";
  const token = "0x94F60B66256311A234277f4062dA7E96eA9c201F";
  const treasury = "0xcB4A894C7B9C4fb7b761e51144b8A4A2b8a1bb35";
  const fundingManager = "0xF990F64C6c5fe91F2B154679Fa60eFebaDD8c4aA";
  const distributionManager = "0x5C02BA4A164646a62a2F32922d3724B417a9F6DA";
  const marketplace = "0x3Eb99DD69C321AC54a450023EaEFbDb5644CEf3c";
  const oracle = "0x9251a65fd04922277EF3408846e3322Cc6358a5b";

  console.log("====================================================");
  console.log("STARTING CONTRACT VERIFICATION ON BSCSCAN");
  console.log("====================================================");

  // Verify CompanyRegistry
  console.log("Verifying CompanyRegistry...");
  try {
    await hre.run("verify:verify", { address: registry, constructorArguments: [] });
  } catch (e) { console.log("CompanyRegistry verify status:", e.message); }

  // Verify BoardGovernance
  console.log("Verifying BoardGovernance...");
  try {
    await hre.run("verify:verify", { address: governance, constructorArguments: [["0x75AD18eF47eDa21BafF837CAc0F1563D0C355555"], 1] });
  } catch (e) { console.log("BoardGovernance verify status:", e.message); }

  // Verify EquityToken
  console.log("Verifying EquityToken...");
  try {
    await hre.run("verify:verify", { address: token, constructorArguments: ["PTT Share Token", "PTTS", governance] });
  } catch (e) { console.log("EquityToken verify status:", e.message); }

  // Verify Treasury
  console.log("Verifying Treasury...");
  try {
    await hre.run("verify:verify", { address: treasury, constructorArguments: [governance] });
  } catch (e) { console.log("Treasury verify status:", e.message); }

  // Verify FundingManager
  console.log("Verifying FundingManager...");
  try {
    await hre.run("verify:verify", { address: fundingManager, constructorArguments: [governance] });
  } catch (e) { console.log("FundingManager verify status:", e.message); }

  // Verify DistributionManager
  console.log("Verifying DistributionManager...");
  try {
    await hre.run("verify:verify", { address: distributionManager, constructorArguments: [governance] });
  } catch (e) { console.log("DistributionManager verify status:", e.message); }

  // Verify Marketplace
  console.log("Verifying Marketplace...");
  try {
    await hre.run("verify:verify", { address: marketplace, constructorArguments: [governance, treasury] });
  } catch (e) { console.log("Marketplace verify status:", e.message); }

  // Verify Oracle
  console.log("Verifying Oracle...");
  try {
    await hre.run("verify:verify", { address: oracle, constructorArguments: [governance] });
  } catch (e) { console.log("Oracle verify status:", e.message); }

  console.log("====================================================");
  console.log("VERIFICATION PROCESS COMPLETED!");
  console.log("====================================================");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
