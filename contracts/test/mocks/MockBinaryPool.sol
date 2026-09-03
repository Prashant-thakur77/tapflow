// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20Min} from "../../src/interfaces/IBinaryPool.sol";

/// Minimal pool: an IOC buy pulls price*qty/1e6 collateral from the caller and
/// "fills". `failNext` lets a test force a rejected order.
contract MockBinaryPool {
    uint256 internal constant ONE = 1e6;
    IERC20Min public immutable collateral;
    uint128 public nextId = 1;
    bool public failNext;

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
        uint256 cost = (price * quantity) / ONE;
        require(collateral.transferFrom(msg.sender, address(this), cost), "pull");
        orders.push(Order(msg.sender, kind, price, quantity, cost));
        return (true, nextId++);
    }
}
