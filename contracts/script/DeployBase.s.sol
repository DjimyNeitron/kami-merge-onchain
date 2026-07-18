// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KamiMergeNFT} from "../src/KamiMergeNFT.sol";

/// @notice Deploy the Kami Merge NFT contract to Base mainnet (chainId 8453).
///         Second edition of the same collection — identical mint logic,
///         typeId math, royalty (250 bps), tokenId sequencing, and events as
///         the Soneium deployment. The only source difference vs Soneium is
///         the owner-updatable metadata base (setBaseURI); the initial base is
///         the same Vercel path, so the two editions resolve identical art.
///
///         NOT executed by CC — the OWNER runs the broadcast + signs (see
///         BASE_DEPLOY.md). Reads the deployer key from env at run time.
///
///         forge script script/DeployBase.s.sol:DeployBase \
///           --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" \
///           --broadcast --verify --verifier etherscan \
///           --etherscan-api-key "$BASESCAN_API_KEY" --chain 8453
contract DeployBase is Script {
    // Same owner / royalty receiver as Soneium (identical EVM address across
    // chains). Deployer must be this address so owner() == treasury.
    address constant ROYALTY_RECEIVER =
        0xc6C83dE905D439004733E2C3f430f08621031Aa8;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        KamiMergeNFT nft = new KamiMergeNFT(ROYALTY_RECEIVER);
        vm.stopBroadcast();
        console.log("KamiMergeNFT (Base 8453) deployed at:", address(nft));
        console.log("Owner / royalty receiver:", ROYALTY_RECEIVER);
    }
}
