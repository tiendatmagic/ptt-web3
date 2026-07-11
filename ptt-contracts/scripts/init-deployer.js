const fs = require("fs");
const path = require("path");
const { Wallet } = require("ethers");
require("dotenv").config({ path: "../.env" });

async function main() {
  const envPath = path.join(__dirname, "../../.env");
  let envContent = "";
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  let privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  let wallet;

  if (!privateKey || privateKey === "0x0000000000000000000000000000000000000000000000000000000000000001" || privateKey === "") {
    console.log("Generating a new deployer wallet...");
    wallet = Wallet.createRandom();
    privateKey = wallet.privateKey;
    
    // Ghi vào file .env ở root
    const lineToAdd = `\nDEPLOYER_PRIVATE_KEY=${privateKey}`;
    fs.appendFileSync(envPath, lineToAdd, "utf8");
    console.log("New deployer wallet private key written to root .env successfully!");
  } else {
    try {
      wallet = new Wallet(privateKey);
    } catch (e) {
      console.error("Invalid DEPLOYER_PRIVATE_KEY in .env file");
      process.exit(1);
    }
  }

  console.log("====================================================");
  console.log("DEPLOYER WALLET INFORMATION");
  console.log("Address:", wallet.address);
  console.log("====================================================");
  console.log("Please faucet some BNB Testnet to the address above.");
  console.log("BNB Testnet Faucet URL: https://testnet.binance.org/faucet-smart");
  console.log("Once the wallet has BNB, run the deploy script:");
  console.log("  npm run deploy:testnet");
  console.log("====================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
