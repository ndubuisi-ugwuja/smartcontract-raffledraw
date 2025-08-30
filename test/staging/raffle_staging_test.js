const { assert } = require("chai");
const { ethers, network } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", function () {
          this.timeout(900000); // 15 minutes

          let raffle, raffleEntranceFee, deployer;

          beforeEach(async () => {
              deployer = (await ethers.getSigners())[0];
              raffle = await ethers.getContract("Raffle", deployer);
              raffleEntranceFee = await raffle.getEntranceFee();
          });

          it("works with live Chainlink Keepers and VRF, picks a winner", async () => {
              console.log("Entering raffle...");
              const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
              await tx.wait(1);

              console.log("Checking upkeep conditions...");
              const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
              console.log("Upkeep needed?", upkeepNeeded);

              if (!upkeepNeeded) {
                  throw new Error("Upkeep not needed yet — interval not passed or no players");
              }

              console.log("Waiting for WinnerPicked event...");

              await new Promise(async (resolve, reject) => {
                  // reject after 15 minutes
                  const timeout = setTimeout(() => reject("Timeout: Winner not picked"), 900000);

                  raffle.once("WinnerPicked", async () => {
                      console.log("WinnerPicked event fired!");

                      try {
                          const recentWinner = await raffle.getRecentWinner();
                          const raffleState = await raffle.getRaffleState();
                          const endingTimeStamp = await raffle.getLastTimeStamp();

                          console.log("Recent winner:", recentWinner);
                          assert.equal(raffleState.toString(), "0");
                          assert(endingTimeStamp > 0);

                          clearTimeout(timeout);
                          resolve();
                      } catch (e) {
                          reject(e);
                      }
                  });
              });
          });
      });
