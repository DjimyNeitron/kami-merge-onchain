// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {KamiMergeNFT} from "../src/KamiMergeNFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract KamiMergeNFTTest is Test {
    KamiMergeNFT internal nft;

    // D1: deployer = royalty receiver = owner.
    address internal constant ROYALTY_RECEIVER =
        0xc6C83dE905D439004733E2C3f430f08621031Aa8;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    string internal constant BASE =
        "https://kami-merge.vercel.app/nft_assets/metadata/";

    // Re-declared so the test can vm.expectEmit against it.
    event Minted(
        address indexed to,
        uint256 indexed tokenId,
        uint8 indexed typeId
    );

    function setUp() public {
        // This test contract is the deployer → owner.
        nft = new KamiMergeNFT(ROYALTY_RECEIVER);
    }

    function test_NameSymbol() public view {
        assertEq(nft.name(), "Kami Merge");
        assertEq(nft.symbol(), "KAMI");
    }

    function test_MintAssignsSequentialIds() public {
        vm.prank(alice);
        uint256 id1 = nft.mint(0);
        vm.prank(alice);
        uint256 id2 = nft.mint(1);
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_MintSetsTokenType() public {
        vm.prank(alice);
        nft.mint(7);
        assertEq(nft.tokenType(1), 7);
    }

    function test_MintEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit Minted(alice, 1, 5);
        vm.prank(alice);
        nft.mint(5);
    }

    function test_MintTransfersOwnership() public {
        vm.prank(alice);
        nft.mint(0);
        assertEq(nft.ownerOf(1), alice);
    }

    function test_TokenURI() public {
        vm.prank(alice);
        nft.mint(0); // tokenId 1, typeId 0
        assertEq(nft.tokenURI(1), string.concat(BASE, "0.json"));

        vm.prank(bob);
        nft.mint(43); // tokenId 2, typeId 43
        assertEq(nft.tokenURI(2), string.concat(BASE, "43.json"));
    }

    function test_RevertOnInvalidTypeId() public {
        vm.expectRevert(
            abi.encodeWithSelector(KamiMergeNFT.InvalidTypeId.selector, uint8(44))
        );
        vm.prank(alice);
        nft.mint(44);
    }

    function test_TypeId43Allowed() public {
        vm.prank(alice);
        uint256 id = nft.mint(43); // boundary — must succeed
        assertEq(id, 1);
        assertEq(nft.tokenType(1), 43);
        assertEq(nft.ownerOf(1), alice);
    }

    function test_RevertOnDoubleMintSameType() public {
        vm.prank(alice);
        nft.mint(3);
        vm.expectRevert(
            abi.encodeWithSelector(
                KamiMergeNFT.AlreadyMinted.selector,
                alice,
                uint8(3)
            )
        );
        vm.prank(alice);
        nft.mint(3);
    }

    function test_DifferentTypesSameWalletOk() public {
        vm.prank(alice);
        nft.mint(0);
        vm.prank(alice);
        nft.mint(1);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.ownerOf(2), alice);
        assertTrue(nft.minted(alice, 0));
        assertTrue(nft.minted(alice, 1));
    }

    function test_SameTypeDifferentWalletsOk() public {
        // D2 is per-wallet, not global.
        vm.prank(alice);
        nft.mint(5);
        vm.prank(bob);
        nft.mint(5);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.ownerOf(2), bob);
        assertTrue(nft.minted(alice, 5));
        assertTrue(nft.minted(bob, 5));
    }

    function test_RoyaltyInfo() public view {
        (address receiver, uint256 amount) = nft.royaltyInfo(1, 10000);
        assertEq(receiver, ROYALTY_RECEIVER);
        assertEq(amount, 250); // 2.5% of 10000
    }

    function test_SetRoyaltyReceiverOnlyOwner() public {
        // Non-owner reverts.
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                alice
            )
        );
        vm.prank(alice);
        nft.setRoyaltyReceiver(alice);

        // Owner (this test contract) updates the receiver.
        address newReceiver = makeAddr("newReceiver");
        nft.setRoyaltyReceiver(newReceiver);
        (address receiver, uint256 amount) = nft.royaltyInfo(1, 10000);
        assertEq(receiver, newReceiver);
        assertEq(amount, 250); // bps unchanged
    }

    function test_SupportsInterface() public view {
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(nft.supportsInterface(0x2a55205a)); // ERC2981
        assertTrue(nft.supportsInterface(0x01ffc9a7)); // ERC165
        assertFalse(nft.supportsInterface(0xffffffff)); // sanity: unsupported
    }

    function test_TotalMinted() public {
        assertEq(nft.totalMinted(), 0);
        vm.prank(alice);
        nft.mint(0);
        assertEq(nft.totalMinted(), 1);
        vm.prank(alice);
        nft.mint(1);
        assertEq(nft.totalMinted(), 2);
    }
}
