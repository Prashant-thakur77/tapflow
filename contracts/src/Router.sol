// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title Router — TapFlow leader-signal broadcaster
/// @notice A leader taps normally on DreamDEX (their own order, their own tokens).
///         To let followers copy them, the leader also calls `broadcast`, which
///         emits `PositionOpened`. CopyHandler is subscribed to that event through
///         Somnia on-chain reactivity and mirrors it into followers' orders in the
///         SAME block — no keeper, no off-chain relay.
/// @dev The signal is a public event, so the leader never custodies follower funds
///      and cannot be front-run into a follower's wallet: followers pre-fund the
///      MirrorVault and set their own ratio + max-loss.
contract Router {
    /// @param leader   who opened the position (indexed for per-leader subscriptions)
    /// @param marketId the DreamDEX binary market (indexed)
    /// @param pool     the pool to trade on
    /// @param side     0 = UP (BUY_YES), 1 = DOWN (BUY_NO)
    /// @param qty      outcome tokens, raw 1e6
    /// @param price    YES price, raw 1e6 (probability)
    /// @param expiryNs order expiry cap in nanoseconds
    event PositionOpened(
        address indexed leader,
        bytes32 indexed marketId,
        address pool,
        uint8 side,
        uint256 qty,
        uint256 price,
        uint64 expiryNs
    );

    /// @notice The topic0 CopyHandler subscribes to. Kept as a constant so the
    ///         deploy script and the handler agree without recomputing it.
    bytes32 public constant POSITION_OPENED_TOPIC =
        keccak256("PositionOpened(address,bytes32,address,uint8,uint256,uint256,uint64)");

    /// @notice Broadcast a tap so followers can mirror it. Anyone can call for
    ///         themselves; `leader` is always `msg.sender`.
    function broadcast(
        bytes32 marketId,
        address pool,
        uint8 side,
        uint256 qty,
        uint256 price,
        uint64 expiryNs
    ) external {
        require(side <= 1, "side");
        require(qty > 0 && price > 0 && price < 1_000_000, "params");
        emit PositionOpened(msg.sender, marketId, pool, side, qty, price, expiryNs);
    }
}
