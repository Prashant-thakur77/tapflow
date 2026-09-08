// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BinaryPoolParams, IBinaryPool, IERC20Min} from "./interfaces/IBinaryPool.sol";
import {IBinaryMarketsModule, IOutcomeToken6909} from "./interfaces/ISettlement.sol";

/// @title MirrorVault — follower custody + copy config for TapFlow
/// @notice A follower deposits tUSDC, names a leader, a mirror ratio, and a max
///         loss. When the leader broadcasts a tap, CopyHandler calls `mirror`
///         (from inside a reactive transaction) and this vault places the
///         follower's proportional order out of their deposited balance. The
///         vault is the pool caller, so it holds the outcome tokens and settles
///         them per follower. A follower's cumulative spend can never exceed
///         their max loss — the cap is enforced on every mirror.
/// @dev Custodial-but-capped, on purpose: a handler cannot sign as the follower,
///      so the funds it draws from must live somewhere it controls. Deposits are
///      withdrawable by the follower at any time; the vault can only place orders
///      and only up to each follower's own cap.
contract MirrorVault {
    uint256 internal constant ONE = 1e6; // tUSDC + outcome tokens are 6 dp
    uint8 internal constant IOC = 2;
    address internal constant NO_BUILDER = address(0);
    /// @dev The venue's price tick and lot are both 1000 raw units today, and an
    ///      off-grid price or quantity reverts with InvalidQuantity. Read from the
    ///      pool at mirror time so a venue change cannot silently break copying.
    uint256 internal constant FALLBACK_GRID = 1000;
    /// @dev Default cushion a follower pays over the leader's limit, in bps of the
    ///      side's own price. The leader's own IOC eats the book at their limit, so
    ///      a mirror priced identically often fills nothing; this is what makes the
    ///      copy actually land. Bounded by MAX_SLIPPAGE_BPS and by the follower's cap.
    uint32 internal constant DEFAULT_SLIPPAGE_BPS = 1500; // 15% of the leg's own price
    uint32 internal constant MAX_SLIPPAGE_BPS = 5000; // 50%
    /// @dev …but never more than 5 points of absolute overpay, and never above 97
    ///      cents a share. A relative cushion alone would push an expensive leg
    ///      (a 90c DOWN) to ~1.00, where the trade cannot profit.
    uint256 internal constant MAX_ABS_CUSHION = 50_000; // 0.05
    uint256 internal constant MAX_UNIT_COST = 970_000; // 0.97

    /// Why a mirror placed nothing. Emitted by CopyHandler so the reason is on chain.
    uint8 internal constant R_OK = 0;
    uint8 internal constant R_INACTIVE = 1;
    uint8 internal constant R_QTY_TOO_SMALL = 2;
    uint8 internal constant R_MAX_LOSS = 3;
    uint8 internal constant R_NO_BUDGET = 4;
    uint8 internal constant R_ORDER_REJECTED = 5;

    struct Follow {
        address leader;
        uint32 ratioBps; // follower qty = leader qty * ratioBps / 10000
        uint256 maxLoss; // cumulative spend cap, raw tUSDC
        uint256 deposited; // total deposited, raw
        uint256 spent; // cumulative escrow spent on mirrors, raw
        bool active;
        uint32 slippageBps; // cushion over the leader's price; 0 = DEFAULT_SLIPPAGE_BPS
        bool capped; // the max-loss cap has refused a mirror; RiskGuard may pause
    }

    IERC20Min public immutable collateral;
    address public owner;
    address public copyHandler; // only address allowed to call mirror()
    address public riskGuard; // only address allowed to pause()

    mapping(address => Follow) public follows; // follower => config
    mapping(address => address[]) internal _followers; // leader => followers
    mapping(address => mapping(address => bool)) internal _isFollower; // leader => follower => in list

    // ── settlement ───────────────────────────────────────────────────────────
    // The vault is the pool caller, so every mirrored fill's outcome tokens are
    // credited to the vault. Per-follower shares are tracked here so a follower
    // can redeem their own winnings after the window settles: the module pulls
    // the vault's winning tokens and pays collateral back, which is credited to
    // the follower's deposit (and is withdrawable at once).
    IBinaryMarketsModule public module; // BinaryMarketsModule (module-routed redeem)
    uint32 public operatorId;
    bytes32 public venueId;
    mapping(address => mapping(bytes32 => uint256[2])) internal _shares; // follower => marketId => [yes, no]

    event Deposited(address indexed follower, uint256 amount, uint256 balance);
    event Withdrawn(address indexed follower, uint256 amount);
    event FollowSet(address indexed follower, address indexed leader, uint256 ratioBps, uint256 maxLoss);
    event FollowCleared(address indexed follower, address indexed leader);
    event FollowerFilled(
        address indexed follower,
        address indexed leader,
        bytes32 indexed marketId,
        uint8 side,
        uint256 qty,
        uint256 cost,
        uint256 spent,
        uint256 maxLoss
    );
    event FollowerPaused(address indexed follower, address indexed leader, uint256 spent, uint256 maxLoss);
    /// @notice The cap refused a mirror: the follower's budget can no longer fund
    ///         the leader's size. RiskGuard subscribes to this and deactivates them.
    event FollowerCapped(address indexed follower, address indexed leader, bytes32 indexed marketId, uint256 wanted, uint256 spent, uint256 maxLoss);
    event WiringSet(address copyHandler, address riskGuard);
    event VenueSet(address module, uint32 operatorId, bytes32 venueId);
    event Redeemed(address indexed follower, bytes32 indexed marketId, uint8 outcomeIdx, uint256 amount, uint256 payout, uint256 balance);

    error NotOwner();
    error NotHandler();
    error NotGuard();
    error NoVenue();
    error NoShares();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address collateral_) {
        collateral = IERC20Min(collateral_);
        owner = msg.sender;
    }

    /// @notice Wire the reactive handlers once after they are deployed.
    function setWiring(address copyHandler_, address riskGuard_) external onlyOwner {
        copyHandler = copyHandler_;
        riskGuard = riskGuard_;
        emit WiringSet(copyHandler_, riskGuard_);
    }

    // ── follower actions ─────────────────────────────────────────────────────

    function deposit(uint256 amount) external {
        require(amount > 0, "amount");
        require(collateral.transferFrom(msg.sender, address(this), amount), "pull");
        follows[msg.sender].deposited += amount;
        follows[msg.sender].capped = false;
        emit Deposited(msg.sender, amount, available(msg.sender));
    }

    /// @notice Start (or update) copying `leader` at `ratioBps`, capped at `maxLoss`,
    ///         paying at most `slippageBps` worse than the leader's own limit price
    ///         (0 keeps the default). Same-block mirrors compete with the leader's
    ///         own order for the book, so a cushion is what makes them fill.
    function setFollowWithSlippage(address leader, uint32 ratioBps, uint256 maxLoss, uint32 slippageBps) public {
        require(slippageBps <= MAX_SLIPPAGE_BPS, "slippage");
        follows[msg.sender].slippageBps = slippageBps;
        setFollow(leader, ratioBps, maxLoss);
    }

    /// @notice Set only the slippage cushion for an existing follow.
    function setSlippage(uint32 slippageBps) external {
        require(slippageBps <= MAX_SLIPPAGE_BPS, "slippage");
        follows[msg.sender].slippageBps = slippageBps;
    }

    /// @notice Start (or update) copying `leader` at `ratioBps`, capped at `maxLoss`.
    function setFollow(address leader, uint32 ratioBps, uint256 maxLoss) public {
        require(leader != address(0) && leader != msg.sender, "leader");
        require(ratioBps > 0 && ratioBps <= 100_000, "ratio"); // up to 10x
        Follow storage f = follows[msg.sender];
        if (f.leader != address(0) && f.leader != leader) _removeFromLeader(f.leader, msg.sender);
        f.leader = leader;
        f.ratioBps = ratioBps;
        f.maxLoss = maxLoss;
        f.capped = false;
        f.active = true;
        if (!_isFollower[leader][msg.sender]) {
            _isFollower[leader][msg.sender] = true;
            _followers[leader].push(msg.sender);
        }
        emit FollowSet(msg.sender, leader, ratioBps, maxLoss);
    }

    function clearFollow() external {
        Follow storage f = follows[msg.sender];
        address leader = f.leader;
        f.active = false;
        if (leader != address(0)) _removeFromLeader(leader, msg.sender);
        emit FollowCleared(msg.sender, leader);
    }

    function withdraw(uint256 amount) external {
        require(amount <= available(msg.sender), "insufficient");
        follows[msg.sender].deposited -= amount;
        require(collateral.transfer(msg.sender, amount), "send");
        emit Withdrawn(msg.sender, amount);
    }

    // ── reactive path (CopyHandler only) ─────────────────────────────────────

    /// @notice Mirror a leader's tap into `follower`'s proportional order, drawn
    ///         from their deposit and bounded by their max loss. Called only by
    ///         CopyHandler, inside the same-block reactive transaction.
    /// @return placed the follower outcome-token qty actually ordered (0 if skipped)
    function mirror(
        address follower,
        bytes32 marketId,
        address pool,
        uint8 side,
        uint256 leaderQty,
        uint256 price,
        uint64 expiryNs
    ) external returns (uint256 placed) {
        (placed,) = mirrorWithReason(follower, marketId, pool, side, leaderQty, price, expiryNs);
    }

    /// @notice Mirror a leader's tap into `follower`'s proportional order, drawn
    ///         from their deposit and bounded by their max loss. Called only by
    ///         CopyHandler, inside the same-block reactive transaction.
    /// @return placed the follower outcome-token qty actually ordered (0 if skipped)
    /// @return reason why nothing was placed (0 when it was)
    function mirrorWithReason(
        address follower,
        bytes32 marketId,
        address pool,
        uint8 side,
        uint256 leaderQty,
        uint256 price,
        uint64 expiryNs
    ) public returns (uint256 placed, uint8 reason) {
        if (msg.sender != copyHandler) revert NotHandler();
        Follow storage f = follows[follower];
        if (!f.active) return (0, R_INACTIVE);

        uint256 grid = _grid(pool);
        // Quantity must sit on the venue's lot grid or the pool reverts.
        uint256 qty = ((leaderQty * f.ratioBps) / 10_000 / grid) * grid;
        if (qty == 0) return (0, R_QTY_TOO_SMALL);

        // Pay up to `slippageBps` worse than the leader, on the grid. The leader's
        // own IOC just consumed the book at their limit; without a cushion the
        // follower's identical order finds nothing left.
        uint256 limit = _cushion(side, price, f.slippageBps == 0 ? DEFAULT_SLIPPAGE_BPS : f.slippageBps, grid);

        // `price` is always the YES price. A BUY_YES escrows price × qty; a
        // BUY_NO (DOWN) escrows (1 − price) × qty. Under-approving a DOWN makes
        // the pool's auto-pull revert, so the side matters here.
        uint256 unitCost = side == 0 ? limit : ONE - limit;
        uint256 cost = (unitCost * qty) / ONE; // buy escrow, raw tUSDC

        // Cap: never let cumulative spend pass the follower's max loss, and never
        // spend more than they deposited.
        if (cost == 0) return (0, R_QTY_TOO_SMALL);
        if (f.spent + cost > f.maxLoss) {
            // `spent` can never reach `maxLoss` exactly (we refuse the order that
            // would cross it), so the cap has to announce itself for the guard.
            if (!f.capped) {
                f.capped = true;
                emit FollowerCapped(follower, f.leader, marketId, cost, f.spent, f.maxLoss);
            }
            return (0, R_MAX_LOSS);
        }
        if (cost > available(follower)) return (0, R_NO_BUDGET);

        // Place the follower's IOC buy from the vault's balance.
        require(collateral.approve(pool, cost), "approve");
        uint8 kind = side == 0 ? 0 : 2; // BUY_YES : BUY_NO
        (bool ok,) = IBinaryPool(pool).placeBinaryOrder(kind, limit, qty, expiryNs, IOC, 0, NO_BUILDER, 0, 0);
        if (!ok) {
            collateral.approve(pool, 0);
            return (0, R_ORDER_REJECTED);
        }
        f.spent += cost;
        _shares[follower][marketId][side] += qty;
        emit FollowerFilled(follower, f.leader, marketId, side, qty, cost, f.spent, f.maxLoss);
        return (qty, R_OK);
    }

    /// @dev The pool's lot/tick size, or the known venue value if the pool does not say.
    function _grid(address pool) internal view returns (uint256) {
        try IBinaryPool(pool).getBinaryPoolParams() returns (BinaryPoolParams memory p) {
            uint256 g = p.oneCollateral / 1000; // 1e6 / 1000 = 1000 today
            return g == 0 ? FALLBACK_GRID : g;
        } catch {
            return FALLBACK_GRID;
        }
    }

    /// @dev The follower's limit price (always expressed as the YES price, as the
    ///      pool wants): `slippageBps` worse than the leader on the side they are
    ///      buying, capped at MAX_ABS_CUSHION points and MAX_UNIT_COST a share,
    ///      then snapped to the grid in the direction that keeps the cushion.
    function _cushion(uint8 side, uint256 price, uint32 slippageBps, uint256 grid) internal pure returns (uint256) {
        uint256 unit = side == 0 ? price : ONE - price; // what this side costs per share
        uint256 bump = (unit * slippageBps) / 10_000;
        if (bump > MAX_ABS_CUSHION) bump = MAX_ABS_CUSHION;
        uint256 worse = unit + bump;
        if (worse > MAX_UNIT_COST) worse = MAX_UNIT_COST;
        if (worse < unit) worse = unit;

        if (side == 0) {
            uint256 up = ((worse + grid - 1) / grid) * grid; // round up: paying more is fine
            uint256 max = ONE - grid;
            return up > max ? max : up;
        }
        // BUY_NO: cost is (ONE − yesPrice), so a higher cost means a lower YES price.
        uint256 yes = ONE - worse;
        yes = (yes / grid) * grid; // round down: keeps the cushion
        return yes < grid ? grid : yes;
    }

    // ── settlement path (anyone, credits the follower) ───────────────────────

    /// @notice Set the venue the vault redeems through. `module` is the
    ///         BinaryMarketsModule; `operatorId`/`venueId` come from MarketCreated.
    function setVenue(address module_, uint32 operatorId_, bytes32 venueId_) external onlyOwner {
        module = IBinaryMarketsModule(module_);
        operatorId = operatorId_;
        venueId = venueId_;
        emit VenueSet(module_, operatorId_, venueId_);
    }

    /// @notice Let the module pull this vault's outcome tokens (ERC-6909 operator
    ///         approval on the singleton outcome token). One call per token.
    function approveOutcomeToken(address outcomeToken) external onlyOwner {
        require(IOutcomeToken6909(outcomeToken).setOperator(address(module), true), "setOperator");
    }

    /// @notice Redeem `follower`'s winning shares on a settled window and credit
    ///         the payout to their deposit. Anyone may call (the payout can only
    ///         go to the follower). `amount` 0 = all of their shares on that side.
    /// @dev The module reverts if the market is not settled or the side did not
    ///      win (a losing side pays nothing and burns nothing), so a wrong call
    ///      costs gas and changes nothing. IOC mirrors can partially fill; if the
    ///      vault holds fewer tokens than recorded, pass the smaller `amount`.
    function redeem(address follower, bytes32 marketId, uint8 outcomeIdx, uint256 amount) public returns (uint256 payout) {
        if (address(module) == address(0)) revert NoVenue();
        uint256 held = _shares[follower][marketId][outcomeIdx];
        if (amount == 0) amount = held;
        if (amount == 0 || amount > held) revert NoShares();
        uint256 before = collateral.balanceOf(address(this));
        module.redeem(operatorId, venueId, marketId, outcomeIdx, amount);
        payout = collateral.balanceOf(address(this)) - before;
        _shares[follower][marketId][outcomeIdx] = held - amount;
        Follow storage f = follows[follower];
        f.deposited += payout;
        emit Redeemed(follower, marketId, outcomeIdx, amount, payout, available(follower));
    }

    /// @notice Redeem several settled windows for one follower in one transaction.
    function redeemMany(address follower, bytes32[] calldata marketIds, uint8[] calldata outcomeIdxs) external returns (uint256 total) {
        require(marketIds.length == outcomeIdxs.length, "len");
        for (uint256 i = 0; i < marketIds.length; i++) {
            total += redeem(follower, marketIds[i], outcomeIdxs[i], 0);
        }
    }

    // ── risk path (RiskGuard only) ───────────────────────────────────────────

    /// @notice Deactivate a follower whose budget can no longer fund the leader's
    ///         size, so no further leader signal is mirrored for them. Called by
    ///         RiskGuard from a reactive transaction on FollowerCapped.
    function pause(address follower) external {
        if (msg.sender != riskGuard) revert NotGuard();
        Follow storage f = follows[follower];
        if (!f.active) return;
        if (f.capped || f.spent >= f.maxLoss) {
            f.active = false;
            if (f.leader != address(0)) _removeFromLeader(f.leader, follower);
            emit FollowerPaused(follower, f.leader, f.spent, f.maxLoss);
        }
    }

    // ── views ────────────────────────────────────────────────────────────────

    function available(address follower) public view returns (uint256) {
        Follow storage f = follows[follower];
        return f.deposited > f.spent ? f.deposited - f.spent : 0;
    }

    /// @notice Outcome shares the vault holds on `follower`'s behalf for a window (0 = Up, 1 = Down).
    function shares(address follower, bytes32 marketId, uint8 outcomeIdx) external view returns (uint256) {
        return _shares[follower][marketId][outcomeIdx];
    }

    function followersOf(address leader) external view returns (address[] memory) {
        return _followers[leader];
    }

    function followerCount(address leader) external view returns (uint256) {
        return _followers[leader].length;
    }

    function _removeFromLeader(address leader, address follower) internal {
        if (!_isFollower[leader][follower]) return;
        _isFollower[leader][follower] = false;
        address[] storage arr = _followers[leader];
        for (uint256 i; i < arr.length; ++i) {
            if (arr[i] == follower) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }
    }
}
