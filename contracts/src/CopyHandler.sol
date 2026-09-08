// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";
import {MirrorVault} from "./MirrorVault.sol";

/// @title CopyHandler — same-block copy trading via Somnia reactivity
/// @notice Subscribed to Router.PositionOpened. When a leader broadcasts a tap,
///         validators deliver that event to `onEvent` as a synthetic transaction
///         in the SAME block, and this contract mirrors it into every follower's
///         order through the MirrorVault — no keeper, no relayer, no next-block lag.
/// @dev The subscription owner (this contract) must hold >= 32 STT when `subscribe`
///      is called, and pays gas for each callback. Fund it before subscribing.
contract CopyHandler is SomniaEventHandler {
    /// Must equal Router.POSITION_OPENED_TOPIC (checked in tests).
    bytes32 public constant POSITION_OPENED_TOPIC =
        keccak256("PositionOpened(address,bytes32,address,uint8,uint256,uint256,uint64)");

    MirrorVault public immutable vault;
    address public immutable router;
    address public owner;
    uint256 public subscriptionId;

    event Subscribed(uint256 indexed subscriptionId, address router);
    event Unsubscribed(uint256 indexed subscriptionId);
    event Mirrored(
        address indexed follower,
        address indexed leader,
        bytes32 indexed marketId,
        uint8 side,
        uint256 qty,
        bool success,
        uint8 reason
    );

    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(MirrorVault vault_, address router_) {
        vault = vault_;
        router = router_;
        owner = msg.sender;
    }

    receive() external payable {}

    /// @notice Create the reactivity subscription to Router.PositionOpened.
    ///         Requires this contract to hold >= 32 STT (see SomniaExtensions).
    function subscribe(uint64 gasLimit) external onlyOwner returns (uint256 id) {
        SomniaExtensions.SubscriptionFilter memory filter = SomniaExtensions.SubscriptionFilter({
            eventTopics: [POSITION_OPENED_TOPIC, bytes32(0), bytes32(0), bytes32(0)],
            origin: address(0),
            emitter: router
        });
        SomniaExtensions.SubscriptionOptions memory opts = SomniaExtensions.defaultSubscriptionOptions();
        if (gasLimit != 0) opts.gasLimit = gasLimit;
        id = SomniaExtensions.subscribe(address(this), filter, opts);
        subscriptionId = id;
        emit Subscribed(id, router);
    }

    function unsubscribe() external onlyOwner {
        SomniaExtensions.unsubscribe(subscriptionId);
        emit Unsubscribed(subscriptionId);
    }

    /// @notice Sweep STT back to the owner (e.g. before decommissioning).
    function sweep(address payable to) external onlyOwner {
        to.transfer(address(this).balance);
    }

    /// @dev Called only by the reactivity precompile (enforced by the base).
    ///      topics: [0]=PositionOpened sig, [1]=leader, [2]=marketId.
    ///      data:   abi.encode(pool, side, qty, price, expiryNs).
    function _onEvent(address emitter, bytes32[] calldata eventTopics, bytes calldata data) internal override {
        if (emitter != router) return; // defense in depth beyond the filter
        address leader = address(uint160(uint256(eventTopics[1])));
        bytes32 marketId = eventTopics[2];
        (address pool, uint8 side, uint256 qty, uint256 price, uint64 expiryNs) =
            abi.decode(data, (address, uint8, uint256, uint256, uint64));

        address[] memory followers = vault.followersOf(leader);
        for (uint256 i; i < followers.length; ++i) {
            // A single failing follower must not revert the whole reactive tx —
            // the owner would pay for a reverted callback and lose the block.
            try vault.mirrorWithReason(followers[i], marketId, pool, side, qty, price, expiryNs) returns (uint256 placed, uint8 reason) {
                emit Mirrored(followers[i], leader, marketId, side, placed, placed > 0, reason);
            } catch {
                // 6 = the vault call itself reverted (never expected; kept so a bad
                // follower can never cost the owner the whole reactive block).
                emit Mirrored(followers[i], leader, marketId, side, 0, false, 6);
            }
        }
    }
}
