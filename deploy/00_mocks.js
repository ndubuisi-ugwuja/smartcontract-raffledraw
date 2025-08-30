// deploy/00_mocks.js
const { developmentChains } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments, network }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    const BASE_FEE = 0n; // charge 0 LINK base
    const GAS_PRICE_LINK = 1n; // 1 wei of LINK per gas
    const WEI_PER_UNIT_LINK = ethers.parseEther("1");

    if (developmentChains.includes(network.name)) {
        log("Local network detected — deploying VRFCoordinatorV2_5Mock...");
        // constructor(uint96 _baseFee, uint96 _gasPriceLink)
        await deploy("VRFCoordinatorV2_5Mock", {
            from: deployer,
            args: [BASE_FEE, GAS_PRICE_LINK, WEI_PER_UNIT_LINK], // 0.1 LINK base fee, 1e9 gasPriceLink
            log: true,
        });
        log("Mocks deployed.");
    }
};
module.exports.tags = ["all", "mocks"];
