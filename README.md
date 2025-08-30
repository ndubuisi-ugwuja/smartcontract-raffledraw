# 🎟️ Raffle Smart Contract

A decentralized raffle (lottery) system built on **Ethereum-compatible blockchains** using **Chainlink VRF v2.5** and **Chainlink Automation**.  
The contract allows users to enter a lottery by paying an entrance fee, and after a set interval a random winner is chosen and awarded the entire pool of funds.

## Etherscan

[View contract on etherscan](https://sepolia.etherscan.io/address/0x84c726066C0907eA6c1E35D2a0fa1DcFD5AE3335)

## ✨ Features

- **Decentralized Randomness**: Secure winner selection powered by [Chainlink VRF v2.5](https://docs.chain.link/vrf/v2-5).
- **Automated Draws**: Uses [Chainlink Automation](https://docs.chain.link/chainlink-automation/introduction) to automatically trigger winner selection after a configured interval.
- **Fair Play**: Ensures only valid entries are accepted and funds are safely transferred to the winner.
- **Configurable**: Supports interval timing, callback gas limits, and VRF subscription parameters.

## 📜 Contract Overview

- **Entrance Fee**: `0.02 ETH` (configurable in code).
- **Raffle States**:
    - `OPEN` → Players can join.
    - `CALCULATING` → A winner is being determined (entries are locked).
- **Events**:
    - `RaffleEnter(address player)` – emitted when a player enters.
    - `RequestedRaffleWinner(uint256 requestId)` – emitted when a randomness request is sent to VRF.
    - `WinnerPicked(address winner)` – emitted when a winner is selected and paid.

## 🛠️ How It Works

1. Players call `enterRaffle()` and pay the entrance fee.
2. Chainlink Automation periodically calls `checkUpkeep()` to verify if:
    - The interval has passed
    - The raffle is open
    - There are players and ETH in the pool
3. If true, `performUpkeep()` is executed, which:
    - Requests randomness from VRF
    - Locks the raffle in `CALCULATING` state
4. VRF responds by calling `fulfillRandomWords()`:
    - A winner is picked using the random number
    - The pool balance is transferred to the winner
    - The raffle resets to `OPEN`

### Prerequisites

- Node.js >= 18
- [Hardhat](https://hardhat.org/)
- Funded [Chainlink VRF v2.5 subscription](https://docs.chain.link/vrf/v2-5/subscription)

## 🛠 Setup and Deployment

1. Clone the repo (optional)

```
   git clone https://github.com/astrohub-dev/smartcontract-raffledraw.git
   cd smartcontract-raffle
```

2. Install dependencies (feel free to use npm if it's your preference)

```bash
   yarn add --dev hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-verify @chainlink/contracts dotenv prettier solhint
```

3. Create .env

```env
   PRIVATE_KEY=your_private_key
   RPC_URL=https://sepolia.infura.io/v3/your_project_id
   ETHERSCAN_API_KEY=your_etherscan_api_key
```

4. Compile contracts

```bash
   npx hardhat compile
```

5. Deploy to sepolia

```bash
   npx hardhat deploy --network sepolia
```

## 🧪 Testing

Run the Hardhat test suite:

```bash
   npx hardhat test
   npx hardhat test --network sepolia
```

Sample tests include:

Only valid entries are accepted

Raffle rejects entries if not open

checkUpkeep correctly signals when upkeep is needed

Winner is selected and paid correctly

🔒 Security Considerations

Ensure your VRF subscription is funded with sufficient LINK.

Do not modify entrance fee logic without adjusting tests.

The contract prevents reentrancy by updating state before transfers.

📖 References

Chainlink VRF v2.5 Docs

Chainlink Automation Docs

👨‍💻 Author: Ndubuisi Ugwuja

📜 License: MIT
