// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Kami Merge NFT
/// @notice ERC-721 + ERC-2981 collection for Kami Merge on Soneium (chainId 1868).
///         44 typeIds (0..43) = 11 yokai x 4 tiers. Permissionless mint, capped to
///         one token per (wallet, typeId). Uncapped supply per typeId. No on-chain
///         score logic — the MIN_MINT_SCORE gate is enforced frontend-side.
contract KamiMergeNFT is ERC721, ERC2981, Ownable {
    using Strings for uint256;

    uint8 public constant MAX_TYPE_ID = 43; // 0..43 inclusive
    uint96 public constant ROYALTY_BPS = 250; // 2.5%
    string private constant BASE =
        "https://kami-merge.vercel.app/nft_assets/metadata/";

    uint256 private _nextTokenId; // first minted tokenId = 1
    mapping(uint256 => uint8) public tokenType; // tokenId => typeId
    mapping(address => mapping(uint8 => bool)) public minted; // D2: per-(wallet,typeId) cap

    event Minted(
        address indexed to,
        uint256 indexed tokenId,
        uint8 indexed typeId
    );

    error InvalidTypeId(uint8 typeId);
    error AlreadyMinted(address wallet, uint8 typeId);

    constructor(address royaltyReceiver)
        ERC721("Kami Merge", "KAMI")
        Ownable(msg.sender)
    {
        _setDefaultRoyalty(royaltyReceiver, ROYALTY_BPS);
    }

    /// @notice Permissionless mint of one NFT of a given typeId. One per (wallet, typeId).
    /// @param typeId The metadata type (0..43) to mint.
    /// @return tokenId The freshly minted token id (sequential, starts at 1).
    function mint(uint8 typeId) external returns (uint256 tokenId) {
        if (typeId > MAX_TYPE_ID) revert InvalidTypeId(typeId);
        if (minted[msg.sender][typeId]) revert AlreadyMinted(msg.sender, typeId);
        minted[msg.sender][typeId] = true;
        tokenId = ++_nextTokenId; // first tokenId = 1
        tokenType[tokenId] = typeId;
        _safeMint(msg.sender, tokenId);
        emit Minted(msg.sender, tokenId, typeId);
    }

    /// @notice Metadata URI for a token — shared per typeId, not per tokenId.
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        _requireOwned(tokenId);
        return
            string.concat(BASE, uint256(tokenType[tokenId]).toString(), ".json");
    }

    /// @notice Owner can update the royalty receiver (D1 — future-proofing).
    function setRoyaltyReceiver(address receiver) external onlyOwner {
        _setDefaultRoyalty(receiver, ROYALTY_BPS);
    }

    /// @notice Total minted so far (for off-chain reads).
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @dev Resolve the multiple inheritance of supportsInterface (ERC721 + ERC2981).
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
