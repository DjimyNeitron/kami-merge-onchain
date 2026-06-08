# Kami Merge NFT Contract

ERC-721 + ERC-2981 for the Kami Merge collection on Soneium mainnet (chainId 1868).

- 44 typeIds (0..43): 11 yokai × 4 tiers
- Permissionless mint, 1 per (wallet, typeId)
- 2.5% royalty (ERC-2981) → 0xc6C83dE905D439004733E2C3f430f08621031Aa8
- tokenURI → https://kami-merge.vercel.app/nft_assets/metadata/{typeId}.json
- Uncapped supply per typeId

## Deployed

| | |
|---|---|
| Network | Soneium mainnet (chainId 1868) |
| Address | [`0x9c21C01a52481a68dB6fad5960d5366D0779983a`](https://soneium.blockscout.com/address/0x9c21C01a52481a68dB6fad5960d5366D0779983a) |
| Blockscout | https://soneium.blockscout.com/address/0x9c21C01a52481a68dB6fad5960d5366D0779983a — **Verified** ✓ |
| Deploy tx | [`0xce74b2e1376190777ca696d0f6ba3f02a2d56ae106ea1f99b808b59c7e85d990`](https://soneium.blockscout.com/tx/0xce74b2e1376190777ca696d0f6ba3f02a2d56ae106ea1f99b808b59c7e85d990) |
| Block | 23905085 · 2026-06-08T18:55:21Z |

Address + metadata are recorded in [`deployments/soneium-mainnet.json`](deployments/soneium-mainnet.json) (read by the frontend in Task 7B-3).

## Setup

`lib/` (OpenZeppelin v5.1.0 + forge-std) is git-ignored, so install dependencies
after a fresh clone before building/testing:

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git
```

## Test

```bash
cd contracts && forge test -vvv && forge coverage
```

## Deploy (reference — already run, see Deployed above)

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.soneium.org/ \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast --verify \
  --verifier blockscout \
  --verifier-url https://soneium.blockscout.com/api/
```

Reads `DEPLOYER_PRIVATE_KEY` from `.env` (git-ignored); hardcodes the D1 royalty receiver.
