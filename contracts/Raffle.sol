// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

/* Errors */
error Raffle__NotOpen();
error Raffle__NotEnoughETHEntered();
error Raffle__WithrawalFailed();
error Raffle__UpkeepNotNeeded(uint256 currentBal, uint256 numPlayers, uint256 raffleState);

/**
 * @title A sample Raffle Contract
 * @author Ndubuisi Ugwuja
 * @notice This contract is for creating a sample raffle contract
 * @dev This implements the Chainlink VRF Version 2
 */
contract Raffle is VRFConsumerBaseV2Plus, AutomationCompatibleInterface {
    /* Types declaration */
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    /* State variables */
    IVRFCoordinatorV2Plus private immutable i_vrfCoordinator;
    bytes32 private immutable i_keyHash;
    uint256 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint256 private immutable i_interval;
    address payable[] public s_players;
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private constant ENTRANCE_FEE = 0.02 ether;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint16 private constant NUM_WORDS = 1;

    /*Events */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    /* Functions */
    constructor(
        address coordinatorV2_5,
        bytes32 keyHash,
        uint256 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2Plus(coordinatorV2_5) {
        i_vrfCoordinator = IVRFCoordinatorV2Plus(coordinatorV2_5);
        i_keyHash = keyHash;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        if (msg.value < ENTRANCE_FEE) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));

        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for `upkeepNeeded` to return True.
     * the following should be true for this to return true:
     * 1. The time interval has passed between raffle runs.
     * 2. The lottery is open.
     * 3. The contract has ETH.
     * 4. Implicity, your subscription is funded with LINK.
     */
    function checkUpkeep(
        bytes calldata /* checkData */
    ) public view override returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasFunds = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasFunds);
        return (upkeepNeeded, bytes(""));
    }

    /**
     * @dev Once `checkUpkeep` is returning `true`, this function is called
     * and it kicks off a Chainlink VRF call to get a random winner.
     */
    function performUpkeep(bytes calldata /* checkData */) external override {
        (bool upkeepNeeded, ) = this.checkUpkeep(bytes(""));
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: i_keyHash,
                subId: i_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: i_callbackGasLimit,
                numWords: NUM_WORDS,
                // pay in LINK from the subscription; set true to pay native
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );
        emit RequestedRaffleWinner(requestId);
    }

    /**
     * @dev This is the function that Chainlink VRF node
     * calls to send the money to the random winner.
     */
    function fulfillRandomWords(uint256 /* requestId */, uint256[] calldata randomWords) internal override {
        // defensive check: ensure there is at least one player
        uint256 playersCount = s_players.length;
        require(playersCount > 0, "Raffle/no-players");

        // pick winner
        uint256 indexOfWinner = randomWords[0] % playersCount;
        address payable recentWinner = s_players[indexOfWinner];

        // update state first (prevents reentrancy & logic races)
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;

        // reset players array
        s_players = new address payable[](0);

        // transfer prize (external call last)
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) revert Raffle__WithrawalFailed();

        emit WinnerPicked(recentWinner);
    }

    /* Getter functions */
    function getEntranceFee() public pure returns (uint256) {
        return ENTRANCE_FEE;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getSubscriptionId() public view returns (uint256) {
        return i_subscriptionId;
    }
}
