// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";
import {MirrorVault} from "./MirrorVault.sol";

/// @title RiskGuard — reactive circuit breaker for followers
/// @notice A second Somnia subscription, this one on MirrorVault.FollowerCapped.
///         The vault refuses any mirror that would cross a follower's max loss,
///         so `spent` stops just below the cap and never reaches it; the refusal
///         itself is the signal. When it fires, validators deliver the event here
///         in the same block and this contract deactivates the follower, so the
///         leader's later signals are not even attempted for them. The spend cap
///         bounds one position; this guard stops the bleed across a run of them.
/// @dev Owner must hold >= 32 STT when subscribing and funds the callbacks.
contract RiskGuard is SomniaEventHandler {
    /// FollowerCapped(address follower, address leader, bytes32 marketId,
    ///                 uint256 wanted, uint256 spent, uint256 maxLoss)
    bytes32 public constant FOLLOWER_CAPPED_TOPIC =
        keccak256("FollowerCapped(address,address,bytes32,uint256,uint256,uint256)");
    /// Kept for the v3 deployment's ABI (that guard listened to fills).
    bytes32 public constant FOLLOWER_FILLED_TOPIC =
        keccak256("FollowerFilled(address,address,bytes32,uint8,uint256,uint256,uint256,uint256)");

    MirrorVault public immutable vault;
    address public owner;
    uint256 public subscriptionId;

    event Subscribed(uint256 indexed subscriptionId, address vault);
    event Unsubscribed(uint256 indexed subscriptionId);
    event Guarded(address indexed follower, uint256 spent, uint256 maxLoss);

    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(MirrorVault vault_) {
        vault = vault_;
        owner = msg.sender;
    }

    receive() external payable {}

    function subscribe(uint64 gasLimit) external onlyOwner returns (uint256 id) {
        SomniaExtensions.SubscriptionFilter memory filter = SomniaExtensions.SubscriptionFilter({
            eventTopics: [FOLLOWER_CAPPED_TOPIC, bytes32(0), bytes32(0), bytes32(0)],
            origin: address(0),
            emitter: address(vault)
        });
        SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions.defaultSubscriptionOptions();
        if (gasLimit != 0) opts.gasLimit = gasLimit;
        id = SomniaExtensions.subscribe(address(this), filter, opts);
        subscriptionId = id;
        emit Subscribed(id, address(vault));
    }

    function unsubscribe() external onlyOwner {
        SomniaExtensions.unsubscribe(subscriptionId);
        emit Unsubscribed(subscriptionId);
    }

    function sweep(address payable to) external onlyOwner {
        to.transfer(address(this).balance);
    }

    /// @dev topics: [0]=sig, [1]=follower, [2]=leader, [3]=marketId.
    ///      data: abi.encode(wanted, spent, maxLoss).
    function _onEvent(address emitter, bytes32[] calldata eventTopics, bytes calldata data) internal override {
        if (emitter != address(vault)) return;
        address follower = address(uint160(uint256(eventTopics[1])));
        (uint256 wanted, uint256 spent, uint256 maxLoss) = abi.decode(data, (uint256, uint256, uint256));
        // The vault re-checks its own state; this is a trigger, not a source of truth.
        vault.pause(follower);
        emit Guarded(follower, spent, maxLoss);
        wanted;
    }
}
