# Kami Merge NFT Contract

ERC-721 + ERC-2981 for the Kami Merge collection on Soneium mainnet (chainId 1868).

- 44 typeIds (0..43): 11 yokai × 4 tiers
- Permissionless mint, 1 per (wallet, typeId)
- 2.5% royalty (ERC-2981) → 0xc6C83dE905D439004733E2C3f430f08621031Aa8
- tokenURI → https://kami-merge.vercel.app/nft_assets/metadata/{typeId}.json
- Uncapped supply per typeId

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

## Deploy (Task 7B-2, not yet run)

```bash
forge script script/Deploy.s.sol --rpc-url $SONEIUM_RPC --broadcast
```

Reads `DEPLOYER_PRIVATE_KEY` from the environment; hardcodes the D1 royalty receiver.
