# Base (8453) deploy runbook — Kami Merge NFT

Deploy the **second edition** of `KamiMergeNFT` to **Base mainnet (chainId 8453)**. Same collection, identical art/metadata; separate per-chain collection. Soneium (1868) @ `0x9c21C01a52481a68dB6fad5960d5366D0779983a` is **not** touched.

**The OWNER runs every command below and signs the broadcast. CC/Claude never holds keys or deploys.**

Gas for the deployer (`0xc6C83dE905D439004733E2C3f430f08621031Aa8`) is already funded on Base.

## What's different from Soneium
The only source change vs the deployed Soneium contract is an owner-updatable metadata base:
- `BASE` (immutable `constant`) → `_baseTokenURI` (mutable state var), initialised in the constructor to the same Vercel path.
- New `function setBaseURI(string calldata newBase) external onlyOwner` (audit finding F4) — lets the owner migrate metadata (e.g. Vercel → IPFS) if the host lapses.

Mint logic, `typeId` math, royalty (250 bps / 2.5%), tokenId sequencing (from 1), and events (`Minted`) are byte-for-byte behaviorally identical. `forge test` (15 tests) passes unchanged.

## 0. Dependencies (fresh clone only — `lib/` is git-ignored)
```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git
```

## 1. Build
```bash
cd contracts
forge build   # solc 0.8.24, optimizer 200 runs
```

## 2. Env (never commit these)
```bash
export BASE_RPC_URL="https://mainnet.base.org"        # or your Base RPC provider
export BASESCAN_API_KEY="<basescan_or_etherscan_v2_key>"
export DEPLOYER_PRIVATE_KEY="0x<owner/treasury key for 0xc6C8…1Aa8>"
```
`foundry.toml` reads `BASE_RPC_URL` / `BASESCAN_API_KEY` from env — nothing is hardcoded.

## 3. Deploy + verify to Base (8453)
```bash
forge script script/DeployBase.s.sol:DeployBase \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast --verify \
  --verifier etherscan \
  --etherscan-api-key "$BASESCAN_API_KEY" \
  --chain 8453
```
The console prints `KamiMergeNFT (Base 8453) deployed at: 0x…`. Record that address — call it `$ADDR`.

> If Basescan verification doesn't auto-complete during the script, verify after the fact:
> ```bash
> forge verify-contract "$ADDR" src/KamiMergeNFT.sol:KamiMergeNFT \
>   --chain 8453 --etherscan-api-key "$BASESCAN_API_KEY" \
>   --constructor-args $(cast abi-encode "constructor(address)" 0xc6C83dE905D439004733E2C3f430f08621031Aa8)
> ```

## 4. Read-back confirmation
```bash
# owner == treasury
cast call "$ADDR" "owner()(address)" --rpc-url "$BASE_RPC_URL"
# → 0xc6C83dE905D439004733E2C3f430f08621031Aa8

# royalty: (receiver, amount) for a 10000-wei sale → (treasury, 250)
cast call "$ADDR" "royaltyInfo(uint256,uint256)(address,uint256)" 1 10000 --rpc-url "$BASE_RPC_URL"
# → 0xc6C8…1Aa8, 250

# name / symbol / max type id
cast call "$ADDR" "name()(string)" --rpc-url "$BASE_RPC_URL"        # → "Kami Merge"
cast call "$ADDR" "symbol()(string)" --rpc-url "$BASE_RPC_URL"      # → "KAMI"
cast call "$ADDR" "MAX_TYPE_ID()(uint8)" --rpc-url "$BASE_RPC_URL"  # → 43
```

`tokenURI(1)` reverts until a token exists (`_requireOwned`). To confirm the metadata shape on-chain, mint one type (consumes the owner's typeId-0 slot on Base — fine, or use a throwaway wallet), then read it:
```bash
cast send "$ADDR" "mint(uint8)" 0 --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$BASE_RPC_URL"
cast call "$ADDR" "tokenURI(uint256)(string)" 1 --rpc-url "$BASE_RPC_URL"
# → https://kami-merge.vercel.app/nft_assets/metadata/0.json
```
`setBaseURI` presence is visible in the verified Basescan source; it's `onlyOwner`, so no read-back needed.

## 5. Report back (for Phase 4 / Phase 3)
Reply with the **new Base contract address** + the sample `tokenURI(1)`. That address feeds:
- Phase 4 — frontend chain→address map,
- Phase 3 — chain-aware `confirm-mint`.

(Phase 2 — the DB `chain_id` migration — is done separately via Supabase MCP and does not need this address.)
