const { assert, expect } = require("chai");
const { parseEther } = require("ethers");
const { network, ethers, deployments, getNamedAccounts } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle, VRFCoordinatorV2_5Mock, raffleEntranceFee, deployer, interval, accounts;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]); // deploy all contracts
              raffle = await ethers.getContract("Raffle", deployer);
              VRFCoordinatorV2_5Mock = await ethers.getContract("VRFCoordinatorV2_5Mock", deployer);
              raffleEntranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
              interval = Number(interval);
              // 🔑 get subscriptionId from the raffle contract
              subId = await raffle.getSubscriptionId();

              // 🔑 fund the subscription with LINK (fix for InsufficientBalance())
              await VRFCoordinatorV2_5Mock.fundSubscription(subId, parseEther("20"));

              // 🔑 make sure raffle is a consumer of the sub
              await VRFCoordinatorV2_5Mock.addConsumer(subId, raffle.target);
          });

          describe("constructor", function () {
              it("initializes the raffle correctly", async function () {
                  const raffleState = await raffle.getRaffleState();
                  const chainId = network.config.chainId;
                  assert.equal(raffleState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[chainId].interval);
              });
          });

          describe("enterRaffle", function () {
              it("reverts if not enough ETH sent", function () {
                  expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered");
              });

              it("records player when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const player = await raffle.getPlayer(0);
                  assert.equal(player, deployer);
              });

              it("emits event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter");
              });

              it("doesn't allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  // simulate time passing
                  await network.provider.send("evm_increaseTime", [interval + 1]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep("0x"); // set to calculating
                  expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__NotOpen");
              });

              describe("checkUpkeep", function () {
                  it("returns false if no ETH has been sent", async function () {
                      await network.provider.send("evm_increaseTime", [interval + 1]);
                      await network.provider.send("evm_mine");

                      const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                      expect(upkeepNeeded).to.be.false;
                  });

                  it("returns false if raffle is not open", async function () {
                      await raffle.enterRaffle({ value: raffleEntranceFee });
                      await network.provider.send("evm_increaseTime", [interval + 1]);
                      await network.provider.send("evm_mine", []);
                      await raffle.performUpkeep("0x");
                      const raffleState = await raffle.getRaffleState();
                      const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                      assert.equal(raffleState.toString(), "1");
                      assert.equal(upkeepNeeded, false);
                  });

                  it("returns false if enough time hasn't passed", async function () {
                      await raffle.enterRaffle({ value: raffleEntranceFee });
                      await network.provider.send("evm_increaseTime", [interval + 1]);
                      await network.provider.request({ method: "evm_mine", params: [] });
                      const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                      assert.equal(!upkeepNeeded, false);
                  });

                  it("returns true if enough time has passed and has players and ETH", async function () {
                      await raffle.enterRaffle({ value: raffleEntranceFee });
                      await network.provider.send("evm_increaseTime", [interval + 1]);
                      await network.provider.send("evm_mine", []);
                      const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                      assert(upkeepNeeded);
                  });
              });

              describe("performUpkeep", function () {
                  it("can only run if checkUpkeep is true", async function () {
                      await raffle.enterRaffle({ value: raffleEntranceFee });
                      await network.provider.send("evm_increaseTime", [interval + 1]);
                      await network.provider.send("evm_mine", []);
                      const tx = await raffle.performUpkeep("0x");
                      assert(tx);
                  });

                  it("reverts when checkUpkeep is false", function () {
                      expect(raffle.performUpkeep("0x")).to.be.revertedWith("Raffle__UpkeepNotNeeded");
                  });

                  it("updates state and emits event", async function () {
                      await raffle.enterRaffle({ value: raffleEntranceFee });
                      await network.provider.send("evm_increaseTime", [interval + 1]);
                      await network.provider.send("evm_mine", []);
                      const txResponse = await raffle.performUpkeep("0x");
                      const txReceipt = await txResponse.wait(1);
                      const raffleState = await raffle.getRaffleState();
                      assert.equal(raffleState.toString(), "1");
                  });
              });

              describe("fulfillRandomWords", function () {
                  beforeEach(async function () {
                      // 1) Have at least one player and advance time so upkeep is eligible
                      await raffle.enterRaffle({ value: raffleEntranceFee });
                      await network.provider.send("evm_increaseTime", [interval + 1]);
                      await network.provider.send("evm_mine", []);
                      accounts = await ethers.getSigners();

                      // 2) Ensure the exact subscription used by the raffle is funded & has raffle as consumer
                      //    (requires a view getter in the contract: getSubscriptionId())
                      const subId = await raffle.getSubscriptionId();

                      // top up LINK balance generously so mock will never revert
                      await VRFCoordinatorV2_5Mock.fundSubscription(subId, ethers.parseEther("100"));

                      // add raffle as consumer (idempotent – safe to call even if already added)
                      await VRFCoordinatorV2_5Mock.addConsumer(subId, raffle.target);
                  });

                  it("can only be called after performUpkeep", async () => {
                      // With v2.5 mock, use the override function and pass fake randomness
                      await expect(VRFCoordinatorV2_5Mock.fulfillRandomWordsWithOverride(0, raffle.target, [777n])).to
                          .be.reverted; // generic revert check is fine here
                      await expect(VRFCoordinatorV2_5Mock.fulfillRandomWordsWithOverride(1, raffle.target, [888n])).to
                          .be.reverted;
                  });

                  it("picks a winner", async function () {
                      const additionalEntrants = 3;
                      const startingAccountIndex = 1;

                      for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
                          const raffleConnected = raffle.connect(accounts[i]);
                          await raffleConnected.enterRaffle({ value: raffleEntranceFee });
                      }

                      const tx = await raffle.performUpkeep("0x");
                      const txReceipt = await tx.wait(1);

                      // Find our own event to get requestId
                      const requestEvent = txReceipt.logs.find(
                          (log) => log.fragment && log.fragment.name === "RequestedRaffleWinner",
                      );
                      if (!requestEvent) throw new Error("RequestedRaffleWinner event not found");
                      const requestId = requestEvent.args[0];

                      // Fulfill with deterministic randomness
                      await VRFCoordinatorV2_5Mock.fulfillRandomWordsWithOverride(requestId, raffle.target, [777n]);

                      const recentWinner = await raffle.getRecentWinner();
                      const ZeroAddress = "0x0000000000000000000000000000000000000000";
                      expect(recentWinner).to.not.equal(ZeroAddress);
                  });

                  it("resets the lottery", async function () {
                      const additionalEntrants = 3;
                      const startingAccountIndex = 1;

                      for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
                          const raffleConnected = raffle.connect(accounts[i]);
                          await raffleConnected.enterRaffle({ value: raffleEntranceFee });
                      }

                      const tx = await raffle.performUpkeep("0x");
                      const txReceipt = await tx.wait(1);

                      const requestEvent = txReceipt.logs.find(
                          (log) => log.fragment && log.fragment.name === "RequestedRaffleWinner",
                      );
                      if (!requestEvent) throw new Error("RequestedRaffleWinner event not found");
                      const requestId = requestEvent.args[0];

                      await VRFCoordinatorV2_5Mock.fulfillRandomWordsWithOverride(requestId, raffle.target, [1234n]);

                      const raffleState = await raffle.getRaffleState();
                      expect(raffleState.toString()).to.equal("0"); // OPEN

                      const numPlayers = await raffle.getNumberOfPlayers();
                      expect(numPlayers.toString()).to.equal("0");
                  });

                  it("sends money to the winner", async function () {
                      const additionalEntrants = 3;
                      const startingAccountIndex = 1;

                      for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
                          const raffleConnected = raffle.connect(accounts[i]);
                          await raffleConnected.enterRaffle({ value: raffleEntranceFee });
                      }

                      const tx = await raffle.performUpkeep("0x");
                      const txReceipt = await tx.wait(1);

                      const requestEvent = txReceipt.logs.find(
                          (log) => log.fragment && log.fragment.name === "RequestedRaffleWinner",
                      );
                      if (!requestEvent) throw new Error("RequestedRaffleWinner event not found");
                      const requestId = requestEvent.args[0];

                      // Snapshot starting balances
                      const startingBalances = {};
                      for (let i = 0; i < accounts.length; i++) {
                          startingBalances[accounts[i].address] = await ethers.provider.getBalance(accounts[i].address);
                      }

                      await VRFCoordinatorV2_5Mock.fulfillRandomWordsWithOverride(requestId, raffle.target, [42n]);

                      const recentWinner = await raffle.getRecentWinner();
                      const winnerEndingBalance = await ethers.provider.getBalance(recentWinner);

                      // prize = (num entrants) * entranceFee (BigInt math)
                      const totalPrize = raffleEntranceFee * BigInt(additionalEntrants + 1);

                      expect(winnerEndingBalance).to.be.greaterThanOrEqual(startingBalances[recentWinner] + totalPrize);
                  });
              });
          });
      });
