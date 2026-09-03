// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {Router} from "../src/Router.sol";
import {MirrorVault} from "../src/MirrorVault.sol";
import {CopyHandler} from "../src/CopyHandler.sol";
import {RiskGuard} from "../src/RiskGuard.sol";

/// @notice Deploy TapFlow's copy-trading stack to Somnia Shannon and create the
///         reactivity subscriptions, printing the subscription ids for the README.
///
/// Requires (env):
///   PRIVATE_KEY   funded deployer
///   COLLATERAL    tUSDC (default the Shannon faucet token)
///   FUND_HANDLERS "true" to send 32 STT to each handler and subscribe
///   SUB_RISKGUARD "true" to also subscribe RiskGuard (needs another 32 STT)
///
/// Each SomniaExtensions.subscribe requires the SUBSCRIBING CONTRACT to hold
/// >= 32 STT at call time, so funding both handlers needs ~64 STT + gas. Ask the
/// hackathon faucet topic for enough STT before running with FUND_HANDLERS=true.
///
/// Run:
///   forge script script/Deploy.s.sol --rpc-url shannon --broadcast -vvv
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address collateral = vm.envOr("COLLATERAL", address(0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E));
        bool fund = vm.envOr("FUND_HANDLERS", false);
        bool subRisk = vm.envOr("SUB_RISKGUARD", false);
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        Router router = new Router();
        MirrorVault vault = new MirrorVault(collateral);
        CopyHandler copyHandler = new CopyHandler(vault, address(router));
        RiskGuard riskGuard = new RiskGuard(vault);
        vault.setWiring(address(copyHandler), address(riskGuard));

        uint256 copySub;
        uint256 riskSub;
        if (fund) {
            // Fund the CopyHandler with the 32 STT subscribe floor + a little for callbacks.
            (bool ok1,) = payable(address(copyHandler)).call{value: 33 ether}("");
            require(ok1, "fund copyHandler");
            copySub = copyHandler.subscribe(0);
            console2.log("CopyHandler subscription id:", copySub);

            if (subRisk) {
                (bool ok2,) = payable(address(riskGuard)).call{value: 33 ether}("");
                require(ok2, "fund riskGuard");
                riskSub = riskGuard.subscribe(0);
                console2.log("RiskGuard subscription id:", riskSub);
            }
        }

        vm.stopBroadcast();

        console2.log("deployer      ", deployer);
        console2.log("Router        ", address(router));
        console2.log("MirrorVault   ", address(vault));
        console2.log("CopyHandler   ", address(copyHandler));
        console2.log("RiskGuard     ", address(riskGuard));

        string memory json = string.concat(
            '{\n  "chainId": 50312,\n',
            '  "router": "', vm.toString(address(router)), '",\n',
            '  "mirrorVault": "', vm.toString(address(vault)), '",\n',
            '  "copyHandler": "', vm.toString(address(copyHandler)), '",\n',
            '  "riskGuard": "', vm.toString(address(riskGuard)), '",\n',
            '  "collateral": "', vm.toString(collateral), '",\n',
            '  "subscriptions": { "copyHandler": "', vm.toString(copySub),
            '", "riskGuard": "', vm.toString(riskSub), '" }\n}\n'
        );
        vm.writeFile("deployments.json", json);
        console2.log("wrote contracts/deployments.json");
    }
}
