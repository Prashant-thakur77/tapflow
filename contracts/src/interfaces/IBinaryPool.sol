// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Minimal DreamDEX binary (Up/Down) pool surface TapFlow needs.
///         Verified against the ec-dreamdex-hackathon-template ABI.
/// @dev kind: 0 BUY_YES(Up) 1 SELL_YES 2 BUY_NO(Down) 3 SELL_NO.
///      orderType: 0 LIMIT 1 FILL_OR_KILL 2 IOC 3 POST_ONLY.
///      price: probability in 1e6 (900000 = 0.90). quantity: 1e6 per whole contract.
struct BinaryPoolParams {
    address collateralToken;
    address market;
    address outcomeToken;
    uint256 yesId;
    uint256 noId;
    uint256 oneCollateral;
    uint256 setBacking;
    address feeRecipient;
    uint256 makerFeeBpsTimes1k;
    uint256 takerFeeBpsTimes1k;
    uint256 maxBuilderFeeBpsTimes1k;
    uint256 settlementFeeBpsTimes1k;
    address settlement;
    uint64 marketNonce;
    bool finalized;
}

interface IBinaryPool {
    function placeBinaryOrder(
        uint8 kind,
        uint256 price,
        uint256 quantity,
        uint64 expireTimestampNs,
        uint8 orderType,
        uint8 selfMatchingOption,
        address builder,
        uint96 builderFeeBpsTimes1k,
        uint64 userData
    ) external payable returns (bool success, uint128 orderId);

    function getBinaryPoolParams() external view returns (BinaryPoolParams memory);
    function marketExpiryNs() external view returns (uint64);
}

interface IERC20Min {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
}
