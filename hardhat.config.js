require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-ignition");
require("@nomicfoundation/hardhat-verify");
require("hardhat-gas-reporter");
require("dotenv").config();
require("hardhat-deploy");
require("hardhat-deploy-ethers");

const { SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY, COINMARKETCAP_API_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.28",
    networks: {
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: [PRIVATE_KEY],
            chainId: 11155111,
        },
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
    sourcify: {
        enabled: true,
    },
    gasReporter: {
        enabled: false,
        outputFile: "gas-report.txt",
        noColors: true,
        currency: "USD",
        etherscan: ETHERSCAN_API_KEY,
        // coinmarketcap: COINMARKETCAP_API_KEY,
        // token: "ETH",
    },
    namedAccounts: {
        deployer: {
            default: 0,
            1: 0,
            11155111: 0,
        },
        player: { default: 1 },
    },
    paths: {
        deploy: "deploy",
    },
};
