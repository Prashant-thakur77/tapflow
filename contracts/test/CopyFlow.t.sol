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
import {MockModule, MockOutcomeToken} from "./mocks/MockSettlement.sol";

contract CopyFlowTest is Test {
    address constant PRECOMPILE = address(0x0100);
    uint256 constant ONE = 1e6;

    Router router;
    MirrorVault vault;
    CopyHandler copyHandler;
    RiskGuard riskGuard;
    MockERC20 usdc;
    MockBinaryPool pool;
    MockOutcomeToken outcome;
    MockModule module;

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

        // Settlement: the pool credits ERC-6909 ids on fill; the module redeems them 1:1.
        outcome = new MockOutcomeToken();
        module = new MockModule(address(usdc), address(outcome));
        pool.setOutcome(address(outcome), 1, 2);
        module.setMarket(marketId, 1, 2);
        usdc.mint(address(module), 1_000 * ONE);
        vault.setVenue(address(module), 2, bytes32(uint256(0x679795)));
        vault.approveOutcomeToken(address(outcome));

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
        // Leader opens 10 UP @ 0.60. Followers pay the 5-point cushion: 0.65.
        // Alice 1x → 10 shares (cost 6.5). Bob 0.5x → 5 (cost 3.25).
        _firePositionOpened(0, 10 * ONE, 600_000, uint64(block.timestamp + 300) * 1e9);
        assertEq(pool.orderCount(), 2, "two mirrored orders");

        (,,,, uint256 aliceSpent,,,) = vault.follows(alice);
        (,,,, uint256 bobSpent,,,) = vault.follows(bob);
        assertEq(aliceSpent, 65 * ONE / 10, "alice escrow 6.5 (0.60 + 5pt cushion)");
        assertEq(bobSpent, 325 * ONE / 100, "bob escrow 3.25 (0.5x)");
        assertEq(usdc.balanceOf(address(pool)), 975 * ONE / 100, "pool pulled 9.75 total");
    }

    function test_mirror_down_escrows_one_minus_price() public {
        // Leader goes DOWN 10 @ YES 0.10 (NO at 0.90). With the 5-point cushion the
        // followers pay NO 0.95: alice 1x → 9.5, bob 0.5x → 4.75.
        _firePositionOpened(1, 10 * ONE, 100_000, uint64(block.timestamp + 300) * 1e9);
        (,,,, uint256 aliceSpent,,,) = vault.follows(alice);
        (,,,, uint256 bobSpent,,,) = vault.follows(bob);
        assertEq(aliceSpent, 95 * ONE / 10, "DOWN escrow is (1-price)*qty with the cushion");
        assertEq(bobSpent, 475 * ONE / 100, "bob half size");
        assertEq(usdc.balanceOf(address(pool)), 1425 * ONE / 100, "pool pulled 14.25 total");
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
        // Alice cap 30. Each 10-share @0.60 buy costs 6.5 with the cushion → 4 fit
        // (26), the 5th would pass 30 and is skipped.
        uint64 exp = uint64(block.timestamp + 300) * 1e9;
        for (uint256 i; i < 6; ++i) {
            _firePositionOpened(0, 10 * ONE, 600_000, exp);
        }
        (,,,, uint256 aliceSpent, bool active,,) = _follow(alice);
        assertEq(aliceSpent, 26 * ONE, "alice stopped below her max loss of 30");
        assertLe(aliceSpent, 30 * ONE, "never past the cap");
        // 6 signals x 2 followers, but alice's last two are skipped → pool orders < 12.
        assertLt(pool.orderCount(), 12);
        active; // silence
    }

    function test_failed_pool_order_is_skipped_not_reverted() public {
        pool.setFailNext(true);
        _firePositionOpened(0, 10 * ONE, 600_000, uint64(block.timestamp + 300) * 1e9);
        // First follower's order fails (skipped, no spend), second still places.
        assertEq(pool.orderCount(), 1, "one placed, one skipped");
    }

    function test_riskguard_pauses_when_the_cap_binds() public {
        // Drive alice until the cap refuses a mirror, then fire RiskGuard on the
        // FollowerCapped event the vault emitted.
        uint64 exp = uint64(block.timestamp + 300) * 1e9;
        for (uint256 i; i < 5; ++i) {
            _firePositionOpened(0, 10 * ONE, 600_000, exp);
        }
        (,,,, uint256 spent,,,) = _follow(alice);
        assertEq(spent, 26 * ONE, "four mirrors at 6.5 fit under the 30 cap");
        assertLt(spent, 30 * ONE, "the cap is never reached exactly; the refusal is the signal");

        // RiskGuard receives FollowerFilled for alice at spent==maxLoss → pause.
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = riskGuard.FOLLOWER_CAPPED_TOPIC();
        topics[1] = bytes32(uint256(uint160(alice)));
        topics[2] = bytes32(uint256(uint160(leader)));
        topics[3] = marketId;
        bytes memory data = abi.encode(uint256(65 * ONE / 10), uint256(26 * ONE), uint256(30 * ONE));
        vm.prank(PRECOMPILE);
        riskGuard.onEvent(address(vault), topics, data);

        (,,,,, bool active,,) = _follow(alice);
        assertFalse(active, "alice paused by risk guard");
        assertEq(vault.followerCount(leader), 1, "alice removed from leader list");
    }

    function test_withdraw_unspent() public {
        _firePositionOpened(0, 10 * ONE, 600_000, uint64(block.timestamp + 300) * 1e9);
        // Alice deposited 50, escrowed 6.5 → 43.5 available.
        assertEq(vault.available(alice), 435 * ONE / 10);
        vm.prank(alice);
        vault.withdraw(435 * ONE / 10);
        // minted 100, deposited 50, withdrew 43.5 → 93.5 in wallet
        assertEq(usdc.balanceOf(alice), 935 * ONE / 10);
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
        returns (address l, uint32 r, uint256 ml, uint256 dep, uint256 spent, bool active, uint32 slip, bool capped)
    {
        return vault.follows(who);
    }

    // ── settlement ───────────────────────────────────────────────────────────

    function test_redeem_credits_follower_after_win() public {
        // Alice mirrors 10 UP @ 0.60 (cost 6). UP wins → 10 tUSDC back into her deposit.
        _firePositionOpened(0, 10 * ONE, 600_000, uint64(block.timestamp + 300) * 1e9);
        assertEq(vault.shares(alice, marketId, 0), 10 * ONE, "shares recorded");
        assertEq(outcome.balanceOf(address(vault), 1), 15 * ONE, "vault holds alice 10 + bob 5 YES");
        assertEq(vault.available(alice), 435 * ONE / 10, "50 deposited - 6.5 escrow");

        module.resolve(marketId, 0);
        uint256 payout = vault.redeem(alice, marketId, 0, 0);
        assertEq(payout, 10 * ONE, "1 tUSDC per winning share");
        assertEq(vault.available(alice), 535 * ONE / 10, "payout credited to the deposit");
        assertEq(vault.shares(alice, marketId, 0), 0, "shares consumed");
        assertEq(outcome.balanceOf(address(vault), 1), 5 * ONE, "bob's shares untouched");

        // and it is withdrawable at once
        vm.prank(alice);
        vault.withdraw(535 * ONE / 10);
        assertEq(usdc.balanceOf(alice), 1035 * ONE / 10, "100 - 50 + 53.5");
    }

    function test_redeem_many_and_partial() public {
        bytes32 m2 = bytes32(uint256(0x121e2));
        module.setMarket(m2, 3, 4);
        _firePositionOpened(0, 10 * ONE, 600_000, uint64(block.timestamp + 300) * 1e9); // marketId, alice 10 YES(id 1)
        module.resolve(marketId, 0);
        // partial: 4 of 10
        assertEq(vault.redeem(alice, marketId, 0, 4 * ONE), 4 * ONE);
        assertEq(vault.shares(alice, marketId, 0), 6 * ONE);
        bytes32[] memory ids = new bytes32[](1);
        uint8[] memory idx = new uint8[](1);
        ids[0] = marketId;
        idx[0] = 0;
        assertEq(vault.redeemMany(alice, ids, idx), 6 * ONE, "rest via redeemMany");
        assertEq(vault.available(alice), 535 * ONE / 10);
    }

    function test_redeem_losing_side_reverts_and_changes_nothing() public {
        _firePositionOpened(0, 10 * ONE, 600_000, uint64(block.timestamp + 300) * 1e9);
        module.resolve(marketId, 1); // DOWN won
        vm.expectRevert(bytes("losing side"));
        vault.redeem(alice, marketId, 0, 0);
        assertEq(vault.shares(alice, marketId, 0), 10 * ONE, "shares intact");
        assertEq(vault.available(alice), 435 * ONE / 10);
    }

    function test_redeem_requires_shares() public {
        module.resolve(marketId, 0);
        vm.expectRevert(MirrorVault.NoShares.selector);
        vault.redeem(alice, marketId, 0, 0);
    }

    // ── the slippage cushion ─────────────────────────────────────────────────

    function test_cushion_stops_at_the_ceiling_and_never_undercuts_the_leader() public {
        // Leader buys DOWN at YES 0.02, i.e. NO at 0.98 — already past the 0.97
        // ceiling. The ceiling caps the CUSHION, not the leader's own choice, so
        // the follower mirrors at 0.98 and no cushion is added on top.
        _firePositionOpened(1, 10 * ONE, 20_000, uint64(block.timestamp + 300) * 1e9);
        (,,,, uint256 aliceSpent,,,) = _follow(alice);
        assertEq(aliceSpent, 98 * ONE / 10, "mirrors the leader's price, adds nothing above the ceiling");

        // A cheap leg does get the full relative cushion (15% of 0.30 = 4.5 points,
        // under the 5-point ceiling), so the follower bids 0.345.
        (,,,, uint256 bobBefore,,,) = _follow(bob);
        vm.prank(bob);
        vault.setFollow(leader, 10_000, 30 * ONE);
        bytes32 m2 = bytes32(uint256(0x121e9));
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = router.POSITION_OPENED_TOPIC();
        topics[1] = bytes32(uint256(uint160(leader)));
        topics[2] = m2;
        vm.prank(PRECOMPILE);
        copyHandler.onEvent(
            address(router), topics, abi.encode(address(pool), uint8(0), 10 * ONE, uint256(300_000), uint64(block.timestamp + 300) * 1e9)
        );
        (,,,, uint256 bobSpent,,,) = _follow(bob);
        assertEq(bobSpent - bobBefore, 345 * ONE / 100, "0.30 + 15% = 0.345 a share on 10 shares");
    }

    function test_cushion_is_configurable_and_bounded() public {
        vm.prank(alice);
        vault.setSlippage(0); // back to the default
        vm.prank(alice);
        vm.expectRevert(bytes("slippage"));
        vault.setSlippage(9_999);
    }

    function test_quantity_is_floored_to_the_lot_grid() public {
        // 10.0005 shares at 1x → floored to 10.000 (the venue's lot is 1000 raw).
        _firePositionOpened(0, 10 * ONE + 500, 600_000, uint64(block.timestamp + 300) * 1e9);
        assertEq(vault.shares(alice, marketId, 0), 10 * ONE, "off-grid size floored, not rejected");
    }

    function test_mirror_reports_a_reason_when_it_places_nothing() public {
        vm.prank(bob);
        vault.clearFollow();
        vm.prank(address(copyHandler));
        (uint256 placed, uint8 reason) =
            vault.mirrorWithReason(bob, marketId, address(pool), 0, 10 * ONE, 600_000, uint64(block.timestamp + 300) * 1e9);
        assertEq(placed, 0);
        assertEq(reason, 1, "R_INACTIVE");
    }
}
