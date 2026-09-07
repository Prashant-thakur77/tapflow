// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IBinaryPool, IERC20Min} from "./interfaces/IBinaryPool.sol";

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

    struct Follow {
        address leader;
        uint32 ratioBps; // follower qty = leader qty * ratioBps / 10000
        uint256 maxLoss; // cumulative spend cap, raw tUSDC
        uint256 deposited; // total deposited, raw
        uint256 spent; // cumulative escrow spent on mirrors, raw
        bool active;
    }

    IERC20Min public immutable collateral;
    address public owner;
    address public copyHandler; // only address allowed to call mirror()
    address public riskGuard; // only address allowed to pause()

    mapping(address => Follow) public follows; // follower => config
    mapping(address => address[]) internal _followers; // leader => followers
    mapping(address => mapping(address => bool)) internal _isFollower; // leader => follower => in list

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
    event WiringSet(address copyHandler, address riskGuard);

    error NotOwner();
    error NotHandler();
    error NotGuard();

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
        emit Deposited(msg.sender, amount, available(msg.sender));
    }

    /// @notice Start (or update) copying `leader` at `ratioBps`, capped at `maxLoss`.
    function setFollow(address leader, uint32 ratioBps, uint256 maxLoss) external {
        require(leader != address(0) && leader != msg.sender, "leader");
        require(ratioBps > 0 && ratioBps <= 100_000, "ratio"); // up to 10x
        Follow storage f = follows[msg.sender];
        if (f.leader != address(0) && f.leader != leader) _removeFromLeader(f.leader, msg.sender);
        f.leader = leader;
        f.ratioBps = ratioBps;
        f.maxLoss = maxLoss;
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
        if (msg.sender != copyHandler) revert NotHandler();
        Follow storage f = follows[follower];
        if (!f.active) return 0;

        uint256 qty = (leaderQty * f.ratioBps) / 10_000;
        if (qty == 0) return 0;
        // `price` is always the YES price. A BUY_YES escrows price × qty; a
        // BUY_NO (DOWN) escrows (1 − price) × qty. Under-approving a DOWN makes
        // the pool's auto-pull revert, so the side matters here.
        uint256 unitCost = side == 0 ? price : ONE - price;
        uint256 cost = (unitCost * qty) / ONE; // buy escrow, raw tUSDC

        // Cap: never let cumulative spend pass the follower's max loss, and never
        // spend more than they deposited.
        if (cost == 0) return 0;
        if (f.spent + cost > f.maxLoss) return 0;
        if (cost > available(follower)) return 0;

        // Place the follower's IOC buy from the vault's balance.
        require(collateral.approve(pool, cost), "approve");
        uint8 kind = side == 0 ? 0 : 2; // BUY_YES : BUY_NO
        (bool ok,) = IBinaryPool(pool).placeBinaryOrder(kind, price, qty, expiryNs, IOC, 0, NO_BUILDER, 0, 0);
        if (!ok) {
            collateral.approve(pool, 0);
            return 0;
        }
        f.spent += cost;
        emit FollowerFilled(follower, f.leader, marketId, side, qty, cost, f.spent, f.maxLoss);
        return qty;
    }

    // ── risk path (RiskGuard only) ───────────────────────────────────────────

    /// @notice Deactivate a follower whose spend has reached their max loss, so no
    ///         further leader signal is mirrored. Called by RiskGuard from a
    ///         reactive transaction on FollowerFilled.
    function pause(address follower) external {
        if (msg.sender != riskGuard) revert NotGuard();
        Follow storage f = follows[follower];
        if (!f.active) return;
        if (f.spent >= f.maxLoss) {
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
