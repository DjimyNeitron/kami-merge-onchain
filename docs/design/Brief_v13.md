# Kami Merge — Design Brief v13

**Status:** All 6 design sessions complete. Ready for implementation phase.
**Sessions covered:** A (NFT economics) · B (Metadata schema) · C (Onboarding) · D (Share/viral) · E (Backend/anti-cheat) · F (Grant submission)
**Date:** May 11, 2026
**Supersedes:** Handoff v11 (gameplay locks) + Handoff v12 (NFT art finalization)

---

## Executive summary

Kami Merge is grant-ready in architecture. Remaining work is implementation (Stages 3.3 → 7) + soft launch + submission.

**Foundation locked:**
- Wallet flow works across 3 surfaces (Farcaster, MetaMask Browser, standalone)
- 88 NFT assets generated (44 static + 44 animated)
- Splash + game loop polished
- Backend designed (Supabase + EIP-712 signed mint)
- Smart contract architecture spec'd

**Estimated to submission:** 5-6 weeks solo work.

---

## Session A — NFT Economics

### Drop probability matrix (Option B, locked)

| Score | Common | Rare | Epic | Legendary |
|---|---|---|---|---|
| 0–500 | 80% | 17% | 2.5% | 0.5% |
| 500–1,500 | 50% | 37% | 11% | 2% |
| 1,500–3,000 | 22% | 48% | 25% | 5% |
| 3,000–5,000 | 5% | 25% | 50% | 20% |
| 5,000+ | 1% | 9% | 35% | 55% |

### Mint mechanics

- Gacha-random: tier weighted by score bracket, deterministic from signed seed
- Yokai = highest reached during game
- 1 NFT per game-over (score ≥ 1,000 minimum, otherwise no mint)
- **Per-wallet cap:** 1 per yokai-tier combination (44 max collection)
- **Cost:** Free, gas only (~$0.001 on Soneium)
- **Soulbound vs tradeable:** Tradeable (ERC-721)
- **Mint trigger:** game over → eligibility check → spinning ceremony

---

## Session B — Metadata Schema

### Attributes (7 traits per NFT)

| trait_type | Type | Example values |
|---|---|---|
| Yokai | string | "Tengu" (11 unique) |
| Kanji | string | "天狗" |
| Tier | string | "Epic" (4 unique) |
| Yokai Rank | number 1-11 | 7 |
| Tier Rank | number 1-4 | 3 |
| Element | string | "Sky" (11 unique, 1:1 with yokai) |
| Aurora Opacity | number | 0.75 |

### Element mapping

| Yokai | Element |
|---|---|
| Kodama | Forest |
| Hitodama | Spirit |
| Tanuki | Earth |
| Kappa | Water |
| Kitsune | Fox |
| Jorogumo | Shadow |
| Tengu | Sky |
| Oni | Fire |
| Raijin | Storm |
| Ryujin | Sea |
| Amaterasu | Sun |

### Description format

`base_lore[yokai] + "\n\n" + tier_flavor[tier]`

- 11 base lore texts (in `kami_merge_nft_lore.md`)
- 4 tier flavor strings (in `kami_merge_nft_lore.md`)
- 15 unique strings total for 44 NFTs

### Other locked items

- **Naming:** `{Yokai} — {Tier}` (em-dash)
- **Royalties:** 2.5% (ERC-2981, 250 basis points) → developer wallet
- **External URL:** `https://kami-merge.vercel.app` for all NFTs
- **Background color:** `0F1626` (indigo)
- **Collection banner:** TBD task ~30 min image generation

---

## Session C — Onboarding

### Tutorial trigger (hybrid)

1. **Splash hint** (subtle, 1 line): "Play to earn yokai NFTs on Soneium"
   - Shown only first launch (localStorage `kami_first_time_seen`)
   - Disappears after first interaction

2. **First-game-over tutorial** (3-screen modal):
   - Triggered before mint ceremony, first time only
   - localStorage flag `kami_onboarding_completed`
   - Skippable at any point

### 3-screen tutorial content

**Screen 1:** "Your run is complete"
- Body: "You merged yokai through the chain. Your score reflects how far you climbed."
- Visual: small yokai chain progression highlighting reached level

**Screen 2:** "Every run earns a yokai NFT"
- Body: "Higher score = better odds for rare tiers. Random within bracket. Drop probabilities are public — view in Help."
- Visual: 4 tier preview cards

**Screen 3:** "Collect all 44"
- Body: "11 yokai × 4 tiers = 44 unique NFTs. Free to mint, just gas (~$0.001 on Soneium). Tradeable on OpenSea."
- Visual: grid preview showing 8-10 NFT cards

### Help modal (5 sections, single scrollable)

1. **Controls** — drag + drop + merge mechanic + animated GIF
2. **Yokai Chain** — 11 sprites in order с kanji + names, tap for lore
3. **NFTs** — drop probability table + tier rarity + mint cost
4. **Leaderboard** — top 100 rules + sign-in requirement
5. **Music** — sound/music toggle + track switcher

### Localization

- **v1:** English only
- **Phase 4 post-grant:** Japanese (JP)
- **Phase 5+:** Russian (RU), other languages

---

## Session D — Share / Viral

### Share triggers

- **Primary:** Post-mint success modal (big "Share" button)
- **Secondary:** Post-game-over screen (smaller "Share score")

### Platforms

| Context | Button order |
|---|---|
| In Farcaster Mini App | Cast → Twitter → Copy |
| Standalone web | Twitter → Farcaster → Copy |
| iOS Safari | + Native share sheet |

### Image generation

- Client canvas overlay (no backend)
- 4 pre-rendered tier templates (1200×630 OG format)
- Dynamic text overlay (score, yokai, tier) via canvas
- Cached per NFT в localStorage
- Generation time target: <300ms

### Cast / tweet texts

**Farcaster cast (с image embed):**
> Just minted **{Yokai} {Tier}** in @kami-merge (score {score})
> 
> Yokai puzzle on @soneium
> 
> kami-merge.vercel.app

**Twitter:**
> Just scored {score} in Kami Merge and earned a **{Yokai} {Tier}** NFT {yokai_emoji}
> 
> 11 yokai × 4 tiers = 44 collectibles on Soneium
> 
> Play free → kami-merge.vercel.app

**Score-only (no mint):**
> I scored {score} in Kami Merge — try to beat me 🎯
> 
> kami-merge.vercel.app

**Yokai emoji map:** 🌳 Kodama, 👻 Hitodama, 🦝 Tanuki, 🐢 Kappa, 🦊 Kitsune, 🕷️ Jorogumo, 🦅 Tengu, 👹 Oni, ⚡ Raijin, 🐉 Ryujin, ☀️ Amaterasu

### Referrals

- URL: `kami-merge.vercel.app?ref={referrer_fid}`
- Supabase `referrals` table tracks attribution
- **No rewards in v1** — just metric tracking
- Reward layer post-launch if viral takeoff

### Auto-cast

- Default OFF
- Settings toggle: "Auto-cast my mints"
- Privacy-first approach

---

## Session E — Backend / Anti-cheat

### Validation approach: Heuristic + EIP-712 signed

Three-stage protection:

1. **Wallet signature** (client) — prevents address forgery
2. **Heuristic checks** (Edge Function) — prevents implausible scores
3. **Signed authorization** (server → contract) — prevents bypass of validation

### Client payload structure

```typescript
type ScoreSubmission = {
  score: number;            // 0..1M
  run_duration_ms: number;  // 0..7,200,000
  highest_yokai: number;    // 0..10
  merge_events: Array<{
    timestamp_ms: number;
    yokai_index: number;
    score_delta: number;
  }>;
  game_seed: string;
  fid: number;
  wallet_address: string;
  signature: string;        // wallet sig over above payload
};
```

### Heuristic rules

| Rule | Threshold |
|---|---|
| Score cap | ≤ 1,000,000 |
| Min duration | ≥ score × 200ms |
| Max duration | ≤ 7,200,000ms (2h) |
| Yokai-score consistency | highest_yokai ≥ score_to_yokai(score) |
| Merge count | ≥ log2(score) |
| Sum check | Σ(merge_events.score_delta) === score |
| Timestamps monotonic | events[i+1] > events[i] |
| Yokai indices valid | 0..10 |
| Wallet signature valid | secp256k1 recover |
| Rate limit not exceeded | See below |

### EIP-712 server signature

```typescript
const types = {
  MintAuthorization: [
    { name: 'wallet', type: 'address' },
    { name: 'yokai', type: 'uint8' },
    { name: 'tier_seed', type: 'uint256' },
    { name: 'score', type: 'uint32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};
```

- 10-min deadline window
- Unique nonce per submission
- Server private key in Vercel env var (rotatable)

### Tier randomness

Deterministic from signed `tier_seed`:
```
roll = keccak256(tier_seed) % 10000
bracket = score_to_bracket(score)
tier = lookup(roll, bracket, drop_matrix)
```

Verifiable on-chain. Client cannot manipulate.

### Leaderboard

- Storage: Supabase only for v1
- `personal_bests` table: wallet_address, fid, username, best_score, best_yokai, nfts_minted, last_updated
- Index: `(best_score DESC)`
- Top-100 query: simple `LIMIT 100`
- On-chain leaderboard: Phase 4 post-grant

### Rate limits

| Scope | Limit | Window |
|---|---|---|
| Per wallet | 30 submissions | 1 hour |
| Per IP | 100 submissions | 1 hour |
| Burst | 5 submissions | 60 sec → 5 min cooldown |
| Score 0 submissions | 5 max | 1 hour |

### Data retention

| Table | Retention |
|---|---|
| `users` | Forever |
| `scores` | 90 days, then archive |
| `personal_bests` | Forever |
| `referrals` | Forever |

### Contract trust model

- Owner sets `signerAddress` at deploy
- Contract verifies EIP-712 signature
- Owner can rotate `signerAddress` if compromised
- Cap enforcement on-chain (deterministic)
- Tier derivation on-chain (no server trust required for tier)

---

## Session F — Grant Submission

### Demo video (60 seconds)

**Beats:**
- 0:00–0:03 Logo animation
- 0:03–0:10 Splash + tap to start
- 0:10–0:25 Gameplay cascade
- 0:25–0:35 Higher tier reveal
- 0:35–0:45 Game over + mint ceremony
- 0:45–0:55 Collection view
- 0:55–1:00 CTA + branding

**Production:** QuickTime screen recording + CapCut editing + existing BGM. No voiceover. ~4-6 hours.

### Twitter/X strategy

**Account:** Create @kamimergegame (or @kami_merge)
**Cadence:** 3 posts / week
**Mix:** Yokai art reveals (1/wk) + dev updates (1/wk) + community engagement (1/wk)
**Tagging:** @Soneium, @StartaleLabs in all relevant posts

### Farcaster strategy

**Account:** Existing @kodymeverik (personal authentic journey)
**Cadence:** Daily / 2-day dev casts
**Focus:** /soneium channel engagement + Mini App embed sharing

### Pitch deck (5 slides PDF)

1. Hook (logo + tagline + value prop)
2. Problem (Mini App ecosystem needs games)
3. Solution (Kami Merge: Suika + yokai + NFT collection)
4. Demo (video link + screenshots)
5. Ask + Roadmap

### Application narrative

Hybrid story angle covering:
- Technical fit (Soneium L2 economics enable collection)
- Market validation (Suika 11M+ copies in Japan)
- Cultural depth (yokai + ukiyo-e original art)
- Distribution (Mini App = instant onboarding)
- Trust (EIP-712 anti-cheat)
- Solo dev consistency (60+ public commits)

### Timeline (5-6 weeks to submission)

| Week | Focus |
|---|---|
| 1 | Stage 3.3-3.8 implementation (UI components) |
| 2 | Stage 7 implementation (contracts + IPFS + deploy) |
| 3 | Soft launch + Twitter account setup |
| 4 | Continue soft launch + demo video production |
| 5 | Grant submissions (Startale + Soneium For All) |
| 6+ | Continued growth + monitor applications |

---

## Implementation order (post design phase)

### Stage 3 — UI completion (Week 1)

1. **3.3 NFTCard.tsx** — Mouse tilt + Aurora holo + tier-scaled intensity
2. **3.4 Inventory** — Grid layout, empty state, NFT detail view
3. **3.5 MintCeremony** — Spinning frame → reveal → mint button
4. **3.6 HelpModal** — 5 sections scrollable
5. **3.7 Onboarding tutorial** — 3-screen modal
6. **3.8 ShareModal** — Buttons + canvas image gen
7. **3.9 Pause overlay** — Resume / Restart / Settings / Help / Quit

### Stage 7 — Contracts + backend (Week 2)

1. `KamiMergeNFT.sol` — ERC-721 + ERC-2981 + EIP-712 verifier
2. Foundry test suite (~400 lines)
3. Deployment script (Soneium mainnet)
4. `submit-score` Edge Function (heuristic + signing)
5. EIP-712 sign/verify helpers
6. `mint` integration в client
7. `referrals` table + tracking trigger
8. IPFS metadata upload (44 JSON files + 88 images)

### Soft launch + grant prep (Weeks 3-5)

- Smoke test mint flow end-to-end
- Twitter account creation + first 5 posts
- Demo video recording + editing
- Pitch deck в Figma
- Application drafts
- Submit Week 5

---

## Reference files (in project knowledge / outputs)

- `kami_merge_nft_lore.md` — 11 base lores + 4 tier flavors (Session B deliverable)
- `Kami_Merge_Handoff_v12.md` — NFT art finalization status
- Earlier handoffs v3-v11 — historical context

---

## What's NOT in this brief (deferred)

- Drop pool composition (which yokai randomly spawn at game start — Suika typically first 5)
- Score formula audit (exact points per merge per tier — locked in code, не documented)
- Game over screen specific layout (visual mockup needed)
- Collection banner image (1400×400 OpenSea banner — ~30 min image gen task)
- Per-yokai detail page routes (Phase 4 post-grant)
- JP localization (Phase 4 post-grant)
- On-chain leaderboard (Phase 4 post-grant)
- Reward layer for referrals (post-launch if traction)

---

*Design phase complete. Implementation begins next session.*
