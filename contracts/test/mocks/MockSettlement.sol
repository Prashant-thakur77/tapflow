// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20Min} from "../../src/interfaces/IBinaryPool.sol";

/// ERC-6909-ish outcome token: balances per id, operator approvals, mint by pools, burn by operators.
contract MockOutcomeToken {
    mapping(address => mapping(uint256 => uint256)) public balanceOf;
    mapping(address => mapping(address => bool)) public isOperator;

    function setOperator(address spender, bool approved) external returns (bool) {
        isOperator[msg.sender][spender] = approved;
        return true;
    }

    function mint(address to, uint256 id, uint256 amount) external {
        balanceOf[to][id] += amount;
    }

    function burnFrom(address from, uint256 id, uint256 amount) external {
        require(isOperator[from][msg.sender], "not operator");
        require(balanceOf[from][id] >= amount, "balance");
        balanceOf[from][id] -= amount;
    }
}

/// Module-routed redemption: pulls the caller's winning tokens (needs operator
/// approval) and pays 1 collateral per share. `resolve` picks the winner.
contract MockModule {
    IERC20Min public immutable collateral;
    MockOutcomeToken public immutable token;
    mapping(bytes32 => uint8) public winner; // marketId => 0 yes / 1 no / 2 unresolved
    mapping(bytes32 => uint256[2]) public ids; // marketId => [yesId, noId]

    constructor(address collateral_, address token_) {
        collateral = IERC20Min(collateral_);
        token = MockOutcomeToken(token_);
    }

    function setMarket(bytes32 marketId, uint256 yesId, uint256 noId) external {
        ids[marketId] = [yesId, noId];
        winner[marketId] = 2;
    }

    function resolve(bytes32 marketId, uint8 win) external {
        winner[marketId] = win;
    }

    function redeem(uint32, bytes32, bytes32 marketId, uint8 outcomeIdx, uint256 amount) external {
        require(winner[marketId] != 2, "not settled");
        require(winner[marketId] == outcomeIdx, "losing side");
        token.burnFrom(msg.sender, ids[marketId][outcomeIdx], amount);
        require(collateral.transfer(msg.sender, amount), "pay");
    }
}
