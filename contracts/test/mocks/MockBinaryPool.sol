// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20Min} from "../../src/interfaces/IBinaryPool.sol";
import {MockOutcomeToken} from "./MockSettlement.sol";

/// Minimal pool: an IOC buy pulls price*qty/1e6 collateral from the caller and
/// "fills". `failNext` lets a test force a rejected order.
contract MockBinaryPool {
    uint256 internal constant ONE = 1e6;
    IERC20Min public immutable collateral;
    uint128 public nextId = 1;
    bool public failNext;
    MockOutcomeToken public token;
    uint256 public yesId;
    uint256 public noId;

    struct Order {
        address caller;
        uint8 kind;
        uint256 price;
        uint256 qty;
        uint256 cost;
    }

    Order[] public orders;

    constructor(address collateral_) {
        collateral = IERC20Min(collateral_);
    }

    /// Mint outcome tokens to the caller on fill, like the real pool credits ERC-6909 ids.
    function setOutcome(address token_, uint256 yesId_, uint256 noId_) external {
        token = MockOutcomeToken(token_);
        yesId = yesId_;
        noId = noId_;
    }

    function setFailNext(bool v) external {
        failNext = v;
    }

    function orderCount() external view returns (uint256) {
        return orders.length;
    }

    function placeBinaryOrder(
        uint8 kind,
        uint256 price,
        uint256 quantity,
        uint64,
        uint8,
        uint8,
        address,
        uint96,
        uint64
    ) external payable returns (bool success, uint128 orderId) {
        if (failNext) {
            failNext = false;
            return (false, 0);
        }
        // kind 0 = BUY_YES escrows price × qty; kind 2 = BUY_NO escrows (1 − price) × qty.
        uint256 unit = kind == 2 ? ONE - price : price;
        uint256 cost = (unit * quantity) / ONE;
        require(collateral.transferFrom(msg.sender, address(this), cost), "pull");
        orders.push(Order(msg.sender, kind, price, quantity, cost));
        if (address(token) != address(0)) token.mint(msg.sender, kind == 2 ? noId : yesId, quantity);
        return (true, nextId++);
    }
}
