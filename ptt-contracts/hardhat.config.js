require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const bscScanApiKey = process.env.ETH_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      evmVersion: "cancun",
      viaIR: true,

    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: [deployerPrivateKey],
    },
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [deployerPrivateKey],
    },
  },
  etherscan: {
    apiKey: {
      bsc: bscScanApiKey,
      bscTestnet: bscScanApiKey,
    },
  },
};
