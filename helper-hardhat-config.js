// Chainlink VRF & Keepers configuration per network
const networkConfig = {
    11155111: {
        name: "sepolia",
        vrfCoordinatorV2_5: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
        keyHash: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
        subscriptionId: "114186114631312620347246787712211226523173313916881804174650131752675512740159",
        callbackGasLimit: "500000", // enough gas for fulfillRandomWords
        interval: 120, // raffle runs every 2 minutes
    },
    31337: {
        name: "localhost",
        // No vrfCoordinatorV2 here, because we'll deploy a mock
        keyHash: "0x6c3699283bda56ad74f6b855546325b68d482e983852a7e34c2d6a8c3f0a5e2a",
        callbackGasLimit: "500000", // Example
        interval: 120, // 2 minutes
        fundAmount: "1000000000000000000000",
    },
};

const developmentChains = ["hardhat", "localhost"];
const frontEndContractsFile = "../nextjs-raffledraw-frontend/constants/contractAddresses.json";
const frontEndAbiFile = "../nextjs-raffledraw-frontend/constants/abi.json";

module.exports = {
    networkConfig,
    developmentChains,
    frontEndContractsFile,
    frontEndAbiFile,
};
