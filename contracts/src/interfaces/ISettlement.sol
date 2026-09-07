// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice The registry a settled position is claimed through (module-routed
///         redemption). Surface taken from ec-dreamdex-hackathon-template
///         (MIT, Somnia) — the module pulls the caller's winning outcome tokens
///         and pays collateral back to the caller.
interface IBinaryMarketsModule {
    /// @param outcomeIdx 0 = Up (YES), 1 = Down (NO).
    function redeem(uint32 operatorId, bytes32 venueId, bytes32 marketId, uint8 outcomeIdx, uint256 amount) external;
}

/// @notice ERC-6909 singleton holding every market's Up/Down as token ids.
interface IOutcomeToken6909 {
    function balanceOf(address owner, uint256 id) external view returns (uint256);
    function isOperator(address owner, address spender) external view returns (bool);
    function setOperator(address spender, bool approved) external returns (bool);
}
