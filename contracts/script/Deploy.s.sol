// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KamiMergeNFT} from "../src/KamiMergeNFT.sol";

/// @notice Deployment script for Task 7B-2 (Soneium mainnet, chainId 1868).
///         NOT executed in this task — reads the deployer key from env at run time.
///         Run:  forge script script/Deploy.s.sol --rpc-url $SONEIUM_RPC --broadcast
contract Deploy is Script {
    // D1: deployer = royalty receiver = owner.
    address constant ROYALTY_RECEIVER =
        0xc6C83dE905D439004733E2C3f430f08621031Aa8;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        KamiMergeNFT nft = new KamiMergeNFT(ROYALTY_RECEIVER);
        vm.stopBroadcast();
        console.log("KamiMergeNFT deployed at:", address(nft));
        console.log("Royalty receiver:", ROYALTY_RECEIVER);
    }
}
