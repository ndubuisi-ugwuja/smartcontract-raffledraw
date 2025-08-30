// deploy/01_raffle.js
const { network } = require("hardhat");
const { deployments, ethers } = require("hardhat");
const { networkConfig, developmentChains } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    // Get chainId properly
    const chainId = await getChainId();
    const config = networkConfig[chainId];

    if (!config || !config.keyHash) {
        throw new Error(`No config found for chainId ${chainId}`);
    }

    // sanity checks to avoid "invalid address/BytesLike (null)"
    const requireHex32 = (v, name) => {
        if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) {
            throw new Error(`Config error: ${name} must be a 32-byte hex string`);
        }
    };
    const requireDefined = (v, name) => {
        if (v === undefined || v === null || v === "") {
            throw new Error(`Config error: ${name} is missing`);
        }
    };

    requireHex32(config.keyHash, "keyHash");
    requireDefined(config.callbackGasLimit, "callbackGasLimit");
    requireDefined(config.interval, "interval");

    let vrfCoordinatorAddress;
    let subscriptionId;

    if (developmentChains.includes(network.name)) {
        // Get the deployed mock
        const vrfDeployment = await deployments.get("VRFCoordinatorV2_5Mock");
        vrfCoordinatorAddress = vrfDeployment.address;

        // Attach a v6 Contract instance
        const vrfMock = await ethers.getContractAt("VRFCoordinatorV2_5Mock", vrfCoordinatorAddress);

        // 1) Create subscription (returns subId via event)
        const tx = await vrfMock.createSubscription();
        const receipt = await tx.wait();
        // Parse SubscriptionCreated(subId, owner)
        const parsed = receipt.logs
            .map((l) => {
                try {
                    return vrfMock.interface.parseLog(l);
                } catch {
                    return null;
                }
            })
            .filter(Boolean)
            .find((e) => e.name === "SubscriptionCreated");
        if (!parsed) throw new Error("Failed to read SubscriptionCreated event");
        subscriptionId = parsed.args.subId;

        // 2) Fund the subscription on mock
        await (await vrfMock.fundSubscription(subscriptionId, config.fundAmount)).wait();
    } else {
        // Real network values must come from helper-hardhat-config/.env
        vrfCoordinatorAddress = config.vrfCoordinatorV2_5;
        subscriptionId = config.subscriptionId;
        requireDefined(vrfCoordinatorAddress, "vrfCoordinatorV2_5");
        requireDefined(subscriptionId, "subscriptionId");
    }

    // Deploy Raffle
    const args = [vrfCoordinatorAddress, config.keyHash, subscriptionId, config.callbackGasLimit, config.interval];

    const raffle = await deploy("Raffle", {
        from: deployer,
        args,
        log: true,
        waitConfirmations: developmentChains.includes(network.name) ? 1 : 3,
    });

    // Add consumer (only local; on testnet do it in Chainlink UI or scripts)
    if (developmentChains.includes(network.name)) {
        const vrfMock = await ethers.getContractAt("VRFCoordinatorV2_5Mock", vrfCoordinatorAddress);
        await (await vrfMock.addConsumer(subscriptionId, raffle.address)).wait();
        log(`Added Raffle as consumer to subId ${subscriptionId.toString()}`);
    }

    log("Raffle deployed at:", raffle.address);
};

module.exports.tags = ["all", "raffle"];
module.exports.dependencies = ["mocks"];
