const { frontEndContractsFile, frontEndAbiFile } = require("../helper-hardhat-config");
const fs = require("fs");
const { ethers, network } = require("hardhat");

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating frontend...");
        await updateAbi();
        await updateContractAddresses();
        console.log("✅ Frontend updated!");
    }
};

async function updateAbi() {
    const raffle = await ethers.getContract("Raffle");
    fs.writeFileSync(frontEndAbiFile, raffle.interface.formatJson());
}

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle");
    let contractAddresses = {};
    try {
        contractAddresses = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf8"));
    } catch (e) {
        console.log("No existing addresses file, creating new one...");
    }

    const chainId = network.config.chainId.toString();

    if (chainId in contractAddresses) {
        if (!contractAddresses[chainId].includes(raffle.target)) {
            contractAddresses[chainId].push(raffle.target);
        }
    } else {
        contractAddresses[chainId] = [raffle.address];
    }

    fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddresses, null, 2));
}

module.exports.tags = ["all", "frontend"];
