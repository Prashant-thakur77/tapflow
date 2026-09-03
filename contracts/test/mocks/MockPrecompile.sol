// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ISomniaReactivityPrecompile} from
    "@somnia-chain/reactivity-contracts/contracts/interfaces/ISomniaReactivityPrecompile.sol";

/// Stand-in for the reactivity precompile at 0x0100 in tests: hands out
/// incrementing ids on subscribe and accepts unsubscribe.
contract MockPrecompile {
    uint256 public n;

    function subscribe(ISomniaReactivityPrecompile.SubscriptionData calldata) external returns (uint256) {
        return ++n;
    }

    function unsubscribe(uint256) external {}
}
