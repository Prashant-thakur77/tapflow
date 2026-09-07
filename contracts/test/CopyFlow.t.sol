// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Router} from "../src/Router.sol";
import {MirrorVault} from "../src/MirrorVault.sol";
import {CopyHandler} from "../src/CopyHandler.sol";
import {RiskGuard} from "../src/RiskGuard.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockBinaryPool} from "./mocks/MockBinaryPool.sol";
import {MockPrecompile} from "./mocks/MockPrecompile.sol";

contract CopyFlowTest is Test {
    address constant PRECOMPILE = address(0x0100);
    uint256 constant ONE = 1e6;

    Router router;
    MirrorVault vault;
    CopyHandler copyHandler;
    RiskGuard riskGuard;
    MockERC20 usdc;
    MockBinaryPool pool;

    address leader = address(0xBEEF);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    bytes32 marketId = bytes32(uint256(0x121e1));

    function setUp() public {
        usdc = new MockERC20();
        pool = new MockBinaryPool(address(usdc));
        router = new Router();
        vault = new MirrorVault(address(usdc));
        copyHandler = new CopyHandler(vault, address(router));
        riskGuard = new RiskGuard(vault);
        vault.setWiring(address(copyHandler), address(riskGuard));

        // Followers fund the vault.
        usdc.mint(alice, 100 * ONE);
        usdc.mint(bob, 100 * ONE);
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(50 * ONE);
        vault.setFollow(leader, 10_000, 30 * ONE); // 1x, max loss 30
        vm.stopPrank();
        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(50 * ONE);
        vault.setFollow(leader, 5_000, 20 * ONE); // 0.5x, max loss 20
        vm.stopPrank();
    }

    /// Craft the calldata the precompile would deliver for a PositionOpened log.
    function _firePositionOpened(uint8 side, uint256 qty, uint256 price, uint64 expiryNs) internal {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = router.POSITION_OPENED_TOPIC();
        topics[1] = bytes32(uint256(uint160(leader)));
        topics[2] = marketId;
        bytes memory data = abi.encode(address(pool), side, qty, price, expiryNs);
        vm.prank(PRECOMPILE);
        copyHandler.onEvent(address(router), topics, data);
    }

    function test_router_broadcasts() public {
        vm.expectEmit(true, true, false, true, address(router));
        emit Router.PositionOpened(leader, marketId, address(pool), 0, 5 * ONE, 600_000, 1);
        vm.prank(leader);
        router.broadcast(marketId, address(pool), 0, 5 * ONE, 600_000, 1);
    }

    function test_followers_registered() public view {
        assertEq(vault.followerCount(leader), 2);
        address[] memory fs = vault.followersOf(leader);
        assertEq(fs.length, 2);
    }

    function test_mirror_places_proportional_orders() public {
        // Leader opens 10 UP @ 0.60. Alice 1x → 10 shares (cost 6). Bob 0.5x → 5 (cost 3).
        _firePositionOpened(0, 10 * ONE, 600_000, uint64(block.timestamp + 300) * 1e9);
        assertEq(pool.orderCount(), 2, "two mirrored orders");

        (,,,, uint256 aliceSpent,) = vault.follows(alice);
        (,,,, uint256 bobSpent,) = vault.follows(bob);
        assertEq(aliceSpent, 6 * ONE, "alice escrow 6");
        assertEq(bobSpent, 3 * ONE, "bob escrow 3 (0.5x)");
        assertEq(usdc.balanceOf(address(pool)), 9 * ONE, "pool pulled 9 total");
    }

    function test_mirror_down_escrows_one_minus_price() public {
        // Leader goes DOWN 10 @ YES 0.10 (i.e. NO at 0.90). Alice 1x → cost 9, Bob 0.5x → 4.5.
        _firePositionOpened(1, 10 * ONE, 100_000, uint64(block.timestamp + 300) * 1e9);
        (,,,, uint256 aliceSpent,) = vault.follows(alice);
        (,,,, uint256 bobSpent,) = vault.follows(bob);
        assertEq(aliceSpent, 9 * ONE, "DOWN escrow is (1-price)*qty");
        assertEq(bobSpent, 45 * ONE / 10, "bob half size");
        assertEq(usdc.balanceOf(address(pool)), 135 * ONE / 10, "pool pulled 13.5 total");
    }

    function test_only_precompile_can_trigger() public {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = router.POSITION_OPENED_TOPIC();
        topics[1] = bytes32(uint256(uint160(leader)));
        topics[2] = marketId;
        bytes memory data = abi.encode(address(pool), uint8(0), 5 * ONE, 600_000, uint64(1));
        vm.expectRevert(); // OnlyReactivityPrecompile()
        copyHandler.onEvent(address(router), topics, data);
    }

    // mirror to bob only via direct call must revert for a non-handler.
    function test_mirror_only_handler() public {
        vm.expectRevert(MirrorVault.NotHandler.selector);
        vault.mirror(alice, marketId, address(pool), 0, 5 * ONE, 600_000, 1);
    }

    function test_max_loss_cap_skips_over_budget() public {
        // Alice cap 30. Repeated 10-share @0.60 buys cost 6 each → 5 fit (30), 6th skipped.
        uint64 exp = uint64(block.timestamp + 300) * 1e9;
        for (uint256 i; i < 6; ++i) {
            _firePositionOpened(0, 10 * ONE, 600_000, exp);
        }
        (,,,, uint256 aliceSpent, bool active) = _follow(alice);
        assertEq(aliceSpent, 30 * ONE, "alice capped at max loss 30");
        // 6 signals x 2 followers, but alice's 6th is skipped → pool orders < 12.
        assertLt(pool.orderCount(), 12);
        active; // silence
    }

    function test_failed_pool_order_is_skipped_not_reverted() public {
        pool.setFailNext(true);
        _firePositionOpened(0, 10 * ONE, 600_000, uint64(block.timestamp + 300) * 1e9);
        // First follower's order fails (skipped, no spend), second still places.
        assertEq(pool.orderCount(), 1, "one placed, one skipped");
    }

    function test_riskguard_pauses_at_maxloss() public {
        // Drive alice to her cap, then fire RiskGuard on the fill event.
        uint64 exp = uint64(block.timestamp + 300) * 1e9;
        for (uint256 i; i < 5; ++i) {
            _firePositionOpened(0, 10 * ONE, 600_000, exp);
        }
        (,,,, uint256 spent,) = _follow(alice);
        assertEq(spent, 30 * ONE);

        // RiskGuard receives FollowerFilled for alice at spent==maxLoss → pause.
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = riskGuard.FOLLOWER_FILLED_TOPIC();
        topics[1] = bytes32(uint256(uint160(alice)));
        topics[2] = bytes32(uint256(uint160(leader)));
        topics[3] = marketId;
        bytes memory data = abi.encode(uint8(0), uint256(10 * ONE), uint256(6 * ONE), uint256(30 * ONE), uint256(30 * ONE));
        vm.prank(PRECOMPILE);
        riskGuard.onEvent(address(vault), topics, data);

        (,,,,, bool active) = _follow(alice);
        assertFalse(active, "alice paused by risk guard");
        assertEq(vault.followerCount(leader), 1, "alice removed from leader list");
    }

    function test_withdraw_unspent() public {
        _firePositionOpened(0, 10 * ONE, 600_000, uint64(block.timestamp + 300) * 1e9);
        // Alice deposited 50, spent 6 → 44 available.
        assertEq(vault.available(alice), 44 * ONE);
        vm.prank(alice);
        vault.withdraw(44 * ONE);
        // minted 100, deposited 50, withdrew 44 → 94 in wallet
        assertEq(usdc.balanceOf(alice), 94 * ONE);
    }

    function test_subscribe_requires_32_stt() public {
        // Under-funded handler reverts on the balance gate.
        vm.expectRevert();
        copyHandler.subscribe(0);

        // Fund + etch the mock precompile, then subscribe returns an id.
        MockPrecompile mp = new MockPrecompile();
        vm.etch(PRECOMPILE, address(mp).code);
        vm.deal(address(copyHandler), 32 ether);
        uint256 id = copyHandler.subscribe(0);
        assertEq(id, 1);
        assertEq(copyHandler.subscriptionId(), 1);
    }

    function _follow(address who)
        internal
        view
        returns (address l, uint32 r, uint256 ml, uint256 dep, uint256 spent, bool active)
    {
        return vault.follows(who);
    }
}
